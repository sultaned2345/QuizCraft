// src/app/legal/terms/page.tsx
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const TERMS_CONTENT = `
**PLEASE READ CAREFULLY. THESE TERMS CONTAIN A MANDATORY ARBITRATION PROVISION AND CLASS ACTION WAIVER.**

By accessing or using the QuizCraft website and application ("Services"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you must immediately cease using the Services.

These Terms are a binding legal agreement between you and **QuizCraft**, operating under the laws of **Ras Al-Khaimah, United Arab Emirates**.

---

### 1. Eligibility & Age Restriction

**The Services are strictly intended for users who are at least 13 years of age.**

* **Under 18:** If you are under 18 years old, you may use the Services only with the approval and supervision of a parent or legal guardian.
* **Prohibited Users:** If you are under 13, you are **not permitted** to register for an account or provide any personal information. We reserve the right to immediately delete accounts found to be in violation of this policy.

---

### 2. Acceptable Use & Conduct

You agree to use the Services only for lawful, personal, and educational purposes. You strictly agree **NOT** to:
* **Upload Illegal Content:** You will not upload content that infringes on any copyright, trademark, or privacy right.
* **Violate Academic Integrity:** You will not use the Services to cheat, plagiarize, or complete assignments where AI assistance is prohibited.
* **Reverse Engineer:** You will not attempt to decompile, reverse engineer, or scrape the source code or content of the Services.
* **Harm the Platform:** You will not upload viruses, overload our servers (DDoS), or attempt to bypass our security measures.

**Violation of these rules may result in immediate account termination without refund.**

---

### 3. Intellectual Property Rights

* **Your Content:** You retain ownership of the documents you upload. However, by uploading, you grant QuizCraft a worldwide, royalty-free license to use, host, store, and modify your content **solely for the purpose of providing the Services** (e.g., generating your quiz).
* **Our Content:** The QuizCraft interface, logo, code, and AI generation logic are the exclusive property of QuizCraft. You may not copy or mirror our interface.

---

### 4. Payment, Refunds, and Cancellations

* **No "Change of Mind" Refunds:** All sales are final. Refunds are strictly limited to cases of proven **technical failure** where our support team cannot resolve the issue within 7 days.
* **Subscription Renewal:** Subscriptions automatically renew. **You may cancel your subscription at any time before the current billing cycle ends to prevent the next renewal.** Your access to premium features will continue until the end of the current billing cycle.
* **Price Changes:** We reserve the right to change pricing with 30 days' notice. Continued use after the change constitutes agreement.

---

### 5. STRICT DISCLAIMER OF WARRANTIES

**THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE."**

TO THE FULLEST EXTENT PERMITTED BY LAW, QUIZCRAFT DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

* **No Accuracy Guarantee:** We do not warrant that the AI-generated content is accurate, complete, or error-free. You rely on it at your own risk.
* **No Academic Guarantee:** We do not guarantee any specific grade or academic result.

---

### 6. LIMITATION OF LIABILITY

IN NO EVENT SHALL QUIZCRAFT, ITS DIRECTORS, EMPLOYEES, OR PARTNERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR ACADEMIC STANDING.

OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE **LAST 3 MONTHS**.

---

### 7. INDEMNIFICATION (You Protect Us)

You agree to defend, indemnify, and hold harmless QuizCraft from and against any claims, damages, obligations, losses, liabilities, costs, and expenses (including attorney's fees) arising from:
1.  Your use of the Services.
2.  **Your violation of these Terms.**
3.  Your violation of any third-party right, including copyright or privacy rights (e.g., if you upload a textbook you don't own).

---

### 8. DISPUTE RESOLUTION: ARBITRATION & CLASS ACTION WAIVER

**READ THIS SECTION CAREFULLY. IT LIMITS YOUR LEGAL RIGHTS.**

* **Governing Law:** These Terms shall be governed by the laws of **Ras Al-Khaimah, UAE**.
* **Binding Arbitration:** Any dispute arising from these Terms shall be resolved exclusively through binding arbitration in Ras Al-Khaimah, UAE, in the English language.
* **Class Action Waiver:** **YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.** Disputes will be resolved only on an individual basis.

---

### 9. Force Majeure

QuizCraft shall not be liable for any delay or failure to perform resulting from causes outside its reasonable control, including, but not limited to, acts of God, war, terrorism, riots, embargos, acts of civil or military authorities, fire, floods, accidents, strikes, or shortages of transportation facilities, fuel, energy, labor, or materials.

---

### 10. Changes to Terms

We may modify these Terms at any time. If we make material changes, we will provide notice through the Services. Your continued use of the Services after the effective date constitutes your acceptance of the amended Terms.

---

### 11. Contact Us

**QuizCraft**
**Email:** [sultanbusiness2026@gmail.com](mailto:sultanbusiness2026@gmail.com)
**Jurisdiction:** Ras Al-Khaimah, UAE
`;

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">
          Last Updated: {new Date().toLocaleDateString()}
        </p>
      </div>
      <Separator />
      <Card className="shadow-sm border-muted">
        <CardContent className="p-8">
          <MarkdownViewer content={TERMS_CONTENT} className="prose-zinc dark:prose-invert" />
        </CardContent>
      </Card>
    </div>
  );
}