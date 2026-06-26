import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * 隐私政策页
 *
 * 说明：
 * - 采用 GDPR（欧盟通用数据保护条例）合规措辞，全文使用英文（法律文档的权威语言）；
 * - 使用 prose 排版（max-w-3xl 居中），保证长文本的可读性；
 * - 通过 generateMetadata 生成 SEO 元数据（TDK）。
 */

/** 生成 SEO 元数据 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('privacyTitle'),
    description: t('privacyMetaDesc'),
    robots: { index: true, follow: true },
  };
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      {/* 使用 prose 排版，dark 主题适配 */}
      <article className="prose prose-invert prose-headings:text-white prose-p:text-text-secondary prose-a:text-brand-primary prose-strong:text-white prose-li:text-text-secondary max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-text-tertiary">
          Last updated: June 27, 2026
        </p>

        {/* 引言：适用范围 */}
        <p>
          TokenFusion AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
          &ldquo;our&rdquo;) is committed to protecting and respecting your
          privacy. This Privacy Policy explains how we collect, use, disclose,
          and safeguard your information when you use our website and services.
          This policy complies with the General Data Protection Regulation
          (GDPR) (EU) 2016/679.
        </p>

        {/* 1. 数据控制者 */}
        <h2>1. Data Controller</h2>
        <p>
          TokenFusion AI acts as the data controller for the personal
          information we collect through this website. If you have any
          questions about how we handle your personal data, you can contact us
          at privacy@tokenfusion.ai.
        </p>

        {/* 2. 我们收集的信息 */}
        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li>
            <strong>Account information:</strong> email address, password
            (hashed), nickname, and invite code.
          </li>
          <li>
            <strong>Payment information:</strong> we do not store full credit
            card numbers. Payment processing is handled by third-party payment
            processors.
          </li>
          <li>
            <strong>API keys:</strong> names and prefixes of API keys you
            create.
          </li>
        </ul>
        <h3>2.2 Information Collected Automatically</h3>
        <ul>
          <li>
            <strong>Usage data:</strong> generation history, token consumption,
            and API call logs.
          </li>
          <li>
            <strong>Device information:</strong> device fingerprint (for fraud
            prevention), IP address, and browser type.
          </li>
          <li>
            <strong>Cookies:</strong> authentication tokens and preference
            cookies.
          </li>
        </ul>

        {/* 3. 合法依据（GDPR 第 6 条） */}
        <h2>3. Legal Basis for Processing (GDPR Art. 6)</h2>
        <p>We process your personal data under the following legal bases:</p>
        <ul>
          <li>
            <strong>Consent:</strong> when you explicitly agree to certain
            processing activities.
          </li>
          <li>
            <strong>Performance of a contract:</strong> to provide the services
            you requested.
          </li>
          <li>
            <strong>Legitimate interests:</strong> for fraud prevention and
            service security.
          </li>
          <li>
            <strong>Legal obligation:</strong> to comply with applicable laws.
          </li>
        </ul>

        {/* 4. 数据使用方式 */}
        <h2>4. How We Use Your Information</h2>
        <ul>
          <li>To provide, operate, and maintain our services.</li>
          <li>To process payments and manage your token balance.</li>
          <li>
            To improve our services through usage analytics (aggregated and
            anonymized).
          </li>
          <li>To detect, prevent, and address fraud and abuse.</li>
          <li>To send service-related notifications and updates.</li>
        </ul>
        <p>
          <strong>
            We do not use your personal data or generation inputs to train AI
            models.
          </strong>
        </p>

        {/* 5. 数据共享 */}
        <h2>5. Data Sharing and Disclosure</h2>
        <p>
          We do not sell your personal data. We may share information with:
        </p>
        <ul>
          <li>
            <strong>AI model providers:</strong> only your prompt content is sent
            to the model provider for generation; no account information is
            shared.
          </li>
          <li>
            <strong>Payment processors:</strong> to handle transactions.
          </li>
          <li>
            <strong>Cloud infrastructure providers:</strong> for hosting and
            storage.
          </li>
          <li>
            <strong>Legal authorities:</strong> when required by law or to
            protect our rights.
          </li>
        </ul>

        {/* 6. 数据留存 */}
        <h2>6. Data Retention</h2>
        <p>
          We retain your personal data only for as long as necessary to fulfill
          the purposes outlined in this policy:
        </p>
        <ul>
          <li>Account data: until you request deletion.</li>
          <li>Generation logs: 90 days.</li>
          <li>Payment records: as required by tax and financial regulations.</li>
        </ul>

        {/* 7. GDPR 权利 */}
        <h2>7. Your GDPR Rights</h2>
        <p>Under the GDPR, you have the following rights regarding your data:</p>
        <ul>
          <li>
            <strong>Right of access:</strong> request a copy of your personal
            data.
          </li>
          <li>
            <strong>Right to rectification:</strong> correct inaccurate data.
          </li>
          <li>
            <strong>Right to erasure (&ldquo;right to be forgotten&rdquo;):</strong>{' '}
            request deletion of your data.
          </li>
          <li>
            <strong>Right to restrict processing:</strong> limit how we use your
            data.
          </li>
          <li>
            <strong>Right to data portability:</strong> receive your data in a
            machine-readable format.
          </li>
          <li>
            <strong>Right to object:</strong> object to processing based on
            legitimate interests.
          </li>
          <li>
            <strong>Right to withdraw consent:</strong> at any time.
          </li>
        </ul>
        <p>
          To exercise these rights, contact us at privacy@tokenfusion.ai. We
          will respond within 30 days.
        </p>

        {/* 8. 国际传输 */}
        <h2>8. International Data Transfers</h2>
        <p>
          Your data may be transferred to and processed in countries outside
          your country of residence. We ensure appropriate safeguards are in
          place, such as Standard Contractual Clauses (SCCs), to protect your
          data in accordance with the GDPR.
        </p>

        {/* 9. 数据安全 */}
        <h2>9. Data Security</h2>
        <p>
          We implement industry-standard security measures including TLS
          encryption in transit, AES-256 encryption at rest, and strict access
          controls. However, no method of transmission over the internet is
          100% secure.
        </p>

        {/* 10. 未成年人 */}
        <h2>10. Children&apos;s Privacy</h2>
        <p>
          Our services are not directed to individuals under 16 years of age. We
          do not knowingly collect personal data from children. If you believe we
          have collected data from a child, please contact us for deletion.
        </p>

        {/* 11. 政策变更 */}
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of significant changes by posting a notice on our website or via
          email. Continued use of our services constitutes acceptance of the
          updated policy.
        </p>

        {/* 12. 联系方式 */}
        <h2>12. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or wish to exercise
          your data protection rights, please contact our Data Protection
          Officer at:
        </p>
        <ul>
          <li>Email: privacy@tokenfusion.ai</li>
          <li>Subject: Privacy / GDPR Request</li>
        </ul>

        {/* 返回首页链接 */}
        <p>
          <Link href="/" className="not-prose text-brand-primary hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
