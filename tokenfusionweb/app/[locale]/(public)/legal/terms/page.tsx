import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * 服务条款页
 *
 * 说明：
 * - 规定用户使用 TokenFusion AI 服务的权利与义务；
 * - 使用 prose 排版（max-w-3xl 居中）；
 * - 通过 generateMetadata 生成 SEO 元数据。
 */

/** 生成 SEO 元数据 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('termsTitle'),
    description: t('termsMetaDesc'),
    robots: { index: true, follow: true },
  };
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* prose 排版 */}
      <article className="prose prose-invert prose-headings:text-white prose-p:text-text-secondary prose-a:text-brand-primary prose-strong:text-white prose-li:text-text-secondary max-w-none">
        <h1>Terms of Service</h1>
        <p className="text-sm text-text-tertiary">
          Last updated: June 27, 2026
        </p>

        {/* 1. 接受条款 */}
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using TokenFusion AI services, you agree to be bound
          by these Terms of Service. If you do not agree with any part of these
          terms, you must not use our services.
        </p>

        {/* 2. 服务描述 */}
        <h2>2. Description of Services</h2>
        <p>
          TokenFusion AI provides AI generation services including chat, image
          generation, video generation, and code generation, accessible through
          our website and API. Services are billed based on a universal token
          system.
        </p>

        {/* 3. 账户 */}
        <h2>3. Accounts</h2>
        <ul>
          <li>
            You must provide accurate information when creating an account.
          </li>
          <li>
            You are responsible for maintaining the security of your account
            and API keys.
          </li>
          <li>
            You must be at least 16 years old to create an account.
          </li>
          <li>
            Temporary email addresses are not permitted for account
            registration.
          </li>
        </ul>

        {/* 4. 令牌与计费 */}
        <h2>4. Tokens and Billing</h2>
        <ul>
          <li>
            Tokens are a virtual currency used to access AI generation
            services.
          </li>
          <li>
            Token balances are non-transferable between accounts.
          </li>
          <li>
            One-time token purchases do not expire. Subscription tokens are
            valid during the subscription period.
          </li>
          <li>
            All payments are processed securely through our payment partners.
          </li>
        </ul>

        {/* 5. 可接受使用 */}
        <h2>5. Acceptable Use Policy</h2>
        <p>You agree not to use our services to:</p>
        <ul>
          <li>Generate content that is illegal, harmful, or offensive.</li>
          <li>
            Violate intellectual property rights or generate infringing
            content.
          </li>
          <li>
            Attempt to bypass rate limits, security measures, or billing
            systems.
          </li>
          <li>
            Use the API to build competing services or resell access without
            authorization.
          </li>
          <li>
            Generate content that violates applicable laws or third-party
            rights.
          </li>
        </ul>

        {/* 6. API 使用 */}
        <h2>6. API Usage</h2>
        <ul>
          <li>
            API access is available on the Pro and Developer plans.
          </li>
          <li>
            Rate limits apply based on your subscription tier.
          </li>
          <li>
            You must keep your API keys confidential and are responsible for all
            usage under your keys.
          </li>
          <li>
            We may suspend API access for abusive usage patterns.
          </li>
        </ul>

        {/* 7. 知识产权 */}
        <h2>7. Intellectual Property</h2>
        <p>
          You retain ownership of the content you generate. However, you are
          responsible for ensuring your prompts and generated content do not
          infringe on third-party rights. AI-generated content may be subject to
          limitations on intellectual property protection in certain
          jurisdictions.
        </p>

        {/* 8. 免责声明 */}
        <h2>8. Disclaimers</h2>
        <ul>
          <li>
            AI-generated content may contain errors, inaccuracies, or biased
            outputs.
          </li>
          <li>
            We do not guarantee the availability, accuracy, or reliability of
            our services.
          </li>
          <li>
            Services are provided on an &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; basis.
          </li>
        </ul>

        {/* 9. 责任限制 */}
        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, TokenFusion AI shall not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, including loss of profits, data, or goodwill,
          arising from your use of the services.
        </p>

        {/* 10. 终止 */}
        <h2>10. Termination</h2>
        <p>
          We may suspend or terminate your access to our services at any time,
          with or without cause, including for violations of these Terms. Upon
          termination, your right to use the services ceases immediately.
        </p>

        {/* 11. 条款变更 */}
        <h2>11. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Material
          changes will be communicated via email or a notice on our website.
          Continued use after changes constitutes acceptance of the updated
          Terms.
        </p>

        {/* 12. 管辖法律 */}
        <h2>12. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with
          applicable laws, without regard to conflict of law principles.
        </p>

        {/* 13. 联系方式 */}
        <h2>13. Contact Us</h2>
        <p>
          For questions about these Terms, contact us at legal@tokenfusion.ai.
        </p>

        <p>
          <Link href="/" className="not-prose text-brand-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
