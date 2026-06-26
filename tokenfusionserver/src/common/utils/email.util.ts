import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * 邮件服务
 * 使用 nodemailer 通过 SMTP 发送邮件
 * 支持：邮箱验证码、密码重置链接等
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    // 从环境变量读取 SMTP 配置
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    this.fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      (smtpUser ? `TokenFusion AI <${smtpUser}>` : 'TokenFusion AI <noreply@tokenfusion.ai>');
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // 创建 SMTP 传输器
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    this.logger.log('邮件服务已初始化');
  }

  /**
   * 发送邮箱验证码邮件
   * @param to 收件人邮箱
   * @param code 6 位验证码
   */
  async sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = 'Verify Your Email - TokenFusion AI';
    const html = this.renderVerificationEmail(code);

    await this.sendMail(to, subject, html);
  }

  /**
   * 发送密码重置邮件
   * @param to 收件人邮箱
   * @param token 重置令牌
   */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subject = 'Reset Your Password - TokenFusion AI';
    const html = this.renderPasswordResetEmail(resetUrl);

    await this.sendMail(to, subject, html);
  }

  /**
   * 底层发送邮件方法
   * @param to 收件人
   * @param subject 主题
   * @param html HTML 内容
   */
  private async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      this.logger.log(`邮件已发送至 ${to}，主题：${subject}`);
    } catch (error) {
      this.logger.error(`邮件发送失败：${to}`, error);
      throw error;
    }
  }

  /**
   * 渲染验证码邮件模板
   */
  private renderVerificationEmail(code: string): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #FFFFFF; padding: 40px;">
        <h1 style="color: #06B6D4; font-size: 24px;">TokenFusion AI</h1>
        <p style="font-size: 16px; line-height: 1.6;">Welcome to TokenFusion AI! Please use the verification code below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #06B6D4; background: #111827; padding: 20px 40px; border-radius: 12px; display: inline-block;">${code}</span>
        </div>
        <p style="font-size: 14px; color: #94A3B8;">This code will expire in 10 minutes. If you did not create an account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #1F2937; margin: 30px 0;" />
        <p style="font-size: 12px; color: #475569;">© 2024 TokenFusion AI. All rights reserved.</p>
      </div>
    `;
  }

  /**
   * 渲染密码重置邮件模板
   */
  private renderPasswordResetEmail(resetUrl: string): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B1120; color: #FFFFFF; padding: 40px;">
        <h1 style="color: #06B6D4; font-size: 24px;">TokenFusion AI</h1>
        <p style="font-size: 16px; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #06B6D4); color: #FFFFFF; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">Reset Password</a>
        </div>
        <p style="font-size: 14px; color: #94A3B8;">This link will expire in 30 minutes. If you did not request a password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #1F2937; margin: 30px 0;" />
        <p style="font-size: 12px; color: #475569;">© 2024 TokenFusion AI. All rights reserved.</p>
      </div>
    `;
  }
}
