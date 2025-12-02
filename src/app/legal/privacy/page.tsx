// src/app/legal/privacy/page.tsx
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const PRIVACY_POLICY_CONTENT = `
**IMPORTANT NOTICE: BY USING QUIZCRAFT, YOU AGREE TO THE PRACTICES DESCRIBED IN THIS POLICY. IF YOU DO NOT AGREE, PLEASE DO NOT USE THE SERVICES.**

This Privacy Policy describes the personal information collected by **QuizCraft** (“we,” “us,” or “our”), a service operating out of **Ras Al-Khaimah, United Arab Emirates**, through our website and application (“Services”).

---

### 1. The Information We Collect

We collect information to provide and improve our Services.

#### A. Information You Provide
* **Account Data:** Email address and profile name via **Supabase Auth** or **Google SSO**.
* **Study Content:** Documents (PDFs, text), notes, and YouTube links you submit for processing.
* **Payment Data:** If you upgrade, our third-party payment processor handles financial data. **We do not store credit card numbers.**

#### B. Automated Collection
* **Analytics:** We use **Vercel Analytics** to track page views and performance.
* **Device Info:** IP address, browser type, and operating system.
* **Cookies:** Strictly necessary cookies for authentication and preferences.

---

### 2. Strict Limitation on AI Liability (Crucial Protection)

**QuizCraft utilizes artificial intelligence (Google Gemini, OpenAI) to generate study materials.**

* **No Academic Guarantee:** The Services are an educational aid only. We **do not guarantee** the accuracy, completeness, or suitability of generated quizzes or notes. **You are solely responsible for verifying all information against your official course materials.**
* **AI Hallucinations:** Artificial Intelligence can occasionally produce incorrect ("hallucinated") or biased information. We expressly disclaim all liability for any grades, exam results, or academic consequences resulting from your use of the Services.
* **Not a Substitute:** This tool is not a substitute for professional instruction or official textbooks.

---

### 3. How We Use and Share Data

* **Third-Party AI Processors:** We transmit your uploaded text to **Google (Gemini)** and **OpenAI** solely to generate your requested content.
    * **Privacy Guarantee:** Your data is **NOT** used to train their public foundation models (in accordance with their enterprise API policies).
    * **Retention:** We retain generated content in our database so you can access it later.
* **Legal Disclosure:** We may disclose data if compelled by UAE law or the laws of the jurisdiction where our servers reside (USA).

---

### 4. Your Rights (GDPR & CCPA)

To ensure maximum global compliance, we extend the following rights to all users:

* **Right to Access:** You may request a copy of all personal data we hold about you.
* **Right to Erasure ("Right to be Forgotten"):** You may request that we delete your account and all associated data.
* **Right to Rectification:** You may update your profile information within the app.
* **Do Not Track:** We **do not** respond to browser DNT signals.

---

### 5. Data Ownership & Intellectual Property

* **Your Content:** You retain ownership of the original documents you upload.
* **Aggregated Data:** You agree that we own all right, title, and interest in **aggregated, anonymized data** derived from your use of the Services (e.g., "Average quiz score for Biology students"). We may use this data to improve our models and sell market insights without further permission or compensation to you.

---

### 6. Governing Law & Dispute Resolution

**This Policy is governed by the laws of Ras Al-Khaimah, United Arab Emirates.**

Any dispute arising from this Policy or your use of the Services shall be subject to the **exclusive jurisdiction** of the courts in Ras Al-Khaimah, UAE. You explicitly waive any objection to this venue.

---

### 7. Security & Breach Notification

We use enterprise-grade security (Supabase RLS, encryption in transit). However, **no system is impenetrable**. In the event of a data breach that threatens your rights, we will notify you within **72 hours** of becoming aware of the breach, in accordance with applicable laws.

---

### 8. Contact Us

For privacy concerns or to exercise your rights:

**Email:** [sultanbusiness2026@gmail.com](mailto:sultanbusiness2026@gmail.com)
**Jurisdiction:** Ras Al-Khaimah, UAE
`;

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          Last Updated: {new Date().toLocaleDateString()}
        </p>
      </div>
      <Separator />
      <Card className="shadow-sm border-muted">
        <CardContent className="p-8">
          <MarkdownViewer content={PRIVACY_POLICY_CONTENT} className="prose-zinc dark:prose-invert" />
        </CardContent>
      </Card>
    </div>
  );
}