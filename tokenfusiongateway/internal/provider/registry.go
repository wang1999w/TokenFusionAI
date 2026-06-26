package provider

import (
	"fmt"
	"sort"
	"sync"
)

// Registry 线程安全的 AI 厂商注册表
// 用于管理所有已注册的底层 AI 服务提供商，支持按名称查找
type Registry struct {
	mu        sync.RWMutex        // 读写锁，保证并发安全
	providers map[string]Provider // 厂商映射表，key 为厂商名称
}

// NewRegistry 创建一个空的厂商注册表
func NewRegistry() *Registry {
	return &Registry{
		providers: make(map[string]Provider),
	}
}

// Register 将一个厂商注册到注册表
// 如果同名厂商已存在，返回错误
func (r *Registry) Register(p Provider) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := p.Name()
	if _, exists := r.providers[name]; exists {
		return fmt.Errorf("provider %q is already registered", name)
	}
	r.providers[name] = p
	return nil
}

// Unregister 按名称从注册表中移除厂商
// 如果指定名称的厂商不存在，返回错误
func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.providers[name]; !exists {
		return fmt.Errorf("provider %q not found", name)
	}
	delete(r.providers, name)
	return nil
}

// Get 按名称获取已注册的厂商
func (r *Registry) Get(name string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("provider %q not found", name)
	}
	return p, nil
}

// List 返回所有已注册的厂商列表
func (r *Registry) List() []Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]Provider, 0, len(r.providers))
	for _, p := range r.providers {
		list = append(list, p)
	}
	return list
}

// Names 返回所有已注册厂商的名称，按字母排序
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
