import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Order } from '../order/entities/order.entity';
import { TokenAccount } from '../billing/entities/token-account.entity';
import { InviteRelation } from '../invite/invite.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

/**
 * 管理后台模块（Phase 7）
 *
 * 注册管理后台所需实体的仓储（users / orders / token_accounts / invite_relations），
 * 对外提供管理服务（AdminService）与管理接口（AdminController）。
 *
 * 说明：
 * - User / Order / TokenAccount 等实体已在各自业务模块中注册，
 *   此处在 AdminModule 内再次注册是为获得本模块作用域的 Repository 注入；
 * - InviteRelation 为 Phase 7 新增实体，此处一并注册。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, TokenAccount, InviteRelation]),
  ],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
