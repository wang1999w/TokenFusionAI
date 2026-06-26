package service

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"tokenfusiongateway/internal/provider"
	"tokenfusiongateway/pkg/logger"
)

// 调度默认参数
const (
	defaultUnavailableTTL  = 30 * time.Second // 故障后默认不可用时长（30 秒后自动恢复探测）
	defaultHealthInterval  = 30 * time.Second // 健康检查默认间隔
	defaultProviderWeight  = 1               // 厂商默认权重
)

// providerState 单个厂商的调度状态
type providerState struct {
	weight          int       // 配置权重
	currentWeight   int       // 平滑加权轮询的当前权重（nginx 算法）
	unavailableUntil time.Time // 不可用截止时间，超过该时间自动恢复
}

// DispatchService 厂商调度服务
// 负责从注册表中选择可用的 AI 厂商，支持：
//   - 加权轮询（平滑加权轮询，nginx 算法）
//   - 故障自动切换：调用失败后标记不可用，自动切换到下一个
//   - 健康检查：定期清理过期的不可用标记，恢复探测
type DispatchService struct {
	registry *provider.Registry      // 厂商注册表
	mu       sync.Mutex             // 保护 states 的并发访问
	states   map[string]*providerState // 各厂商调度状态，key 为厂商名称
}

// NewDispatchService 创建调度服务实例
func NewDispatchService(registry *provider.Registry) *DispatchService {
	return &DispatchService{
		registry: registry,
		states:   make(map[string]*providerState),
	}
}

// SetWeight 设置指定厂商的权重
// weight 越大，被选中的概率越高
func (s *DispatchService) SetWeight(name string, weight int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.getStateLocked(name)
	if weight <= 0 {
		weight = defaultProviderWeight
	}
	st.weight = weight
}

// getStateLocked 获取或创建厂商状态（调用前需持有锁）
func (s *DispatchService) getStateLocked(name string) *providerState {
	st, ok := s.states[name]
	if !ok {
		st = &providerState{weight: defaultProviderWeight}
		s.states[name] = st
	}
	return st
}

// isAvailable 判断厂商当前是否可用（调用前需持有锁）
func (s *DispatchService) isAvailableLocked(st *providerState, now time.Time) bool {
	return st.unavailableUntil.IsZero() || now.After(st.unavailableUntil)
}

// Select 选择一个可用的厂商
// 使用平滑加权轮询算法在可用厂商中选择，若全部不可用则返回 ErrNoProvider
func (s *DispatchService) Select(ctx context.Context) (provider.Provider, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list := s.registry.List()
	if len(list) == 0 {
		return nil, ErrNoProvider
	}

	now := time.Now()

	// 统计可用厂商并累加权重，执行平滑加权轮询（nginx 算法）
	var best provider.Provider
	var bestSt *providerState
	totalWeight := 0

	for _, p := range list {
		st := s.getStateLocked(p.Name())
		if !s.isAvailableLocked(st, now) {
			continue // 跳过不可用厂商
		}

		// 平滑加权轮询：当前权重 += 配置权重
		st.currentWeight += st.weight
		totalWeight += st.weight

		// 选择当前权重最大的厂商
		if best == nil || st.currentWeight > bestSt.currentWeight {
			best = p
			bestSt = st
		}
	}

	if best == nil {
		// 所有厂商均不可用
		return nil, ErrNoProvider
	}

	// 被选中的厂商当前权重 -= 总权重（平滑轮询核心）
	bestSt.currentWeight -= totalWeight

	return best, nil
}

// MarkUnavailable 将指定厂商标记为不可用
// 在调用厂商失败时调用，使其在 ttl 时长内不再被选中，实现故障自动切换
func (s *DispatchService) MarkUnavailable(name string, ttl time.Duration) {
	if ttl <= 0 {
		ttl = defaultUnavailableTTL
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.getStateLocked(name)
	st.unavailableUntil = time.Now().Add(ttl)
	logger.Warn("厂商已标记不可用",
		zap.String("provider", name),
		zap.Duration("ttl", ttl),
	)
}

// MarkAvailable 手动恢复厂商为可用状态（清除不可用标记）
func (s *DispatchService) MarkAvailable(name string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if st, ok := s.states[name]; ok {
		st.unavailableUntil = time.Time{}
	}
}

// Status 返回各厂商的调度状态快照，用于监控/调试
type ProviderStatus struct {
	Name            string    `json:"name"`
	Weight          int       `json:"weight"`
	Available       bool      `json:"available"`
	UnavailableUntil time.Time `json:"unavailable_until,omitempty"`
}

// Status 返回所有厂商的当前调度状态
func (s *DispatchService) Status() []ProviderStatus {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	list := s.registry.List()
	statuses := make([]ProviderStatus, 0, len(list))
	for _, p := range list {
		st := s.getStateLocked(p.Name())
		statuses = append(statuses, ProviderStatus{
			Name:             p.Name(),
			Weight:           st.weight,
			Available:        s.isAvailableLocked(st, now),
			UnavailableUntil: st.unavailableUntil,
		})
	}
	return statuses
}

// StartHealthCheck 启动后台健康检查协程
// 定期清理过期的不可用标记，使故障厂商在 ttl 到期后自动恢复探测
// 该方法会阻塞，应在 goroutine 中调用
func (s *DispatchService) StartHealthCheck(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = defaultHealthInterval
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	logger.Info("厂商健康检查已启动", zap.Duration("interval", interval))

	for {
		select {
		case <-ctx.Done():
			logger.Info("厂商健康检查已停止")
			return
		case <-ticker.C:
			s.healthCheckOnce()
		}
	}
}

// healthCheckOnce 执行一次健康检查
// 清理过期的不可用标记；Phase 6 可扩展为主动探测厂商可用性
func (s *DispatchService) healthCheckOnce() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for name, st := range s.states {
		// 不可用标记已过期，恢复为可用
		if !st.unavailableUntil.IsZero() && now.After(st.unavailableUntil) {
			st.unavailableUntil = time.Time{}
			logger.Info("厂商已恢复可用", zap.String("provider", name))
		}
	}
}
