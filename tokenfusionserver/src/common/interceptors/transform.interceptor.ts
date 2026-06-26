import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ErrorCodes } from '../constants/error-codes';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一响应拦截器：
 * 将控制器返回值包装为 { code: 200, message: "success", data: <返回值> }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: ErrorCodes.SUCCESS,
        message: 'success',
        data,
      })),
    );
  }
}
