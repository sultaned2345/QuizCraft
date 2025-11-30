import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="container max-w-2xl py-20 px-4">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Contact Support</h1>
        <p className="text-muted-foreground">
          Need help with your account, a refund, or have a feature request? We are here to help.
        </p>

        <div className="p-6 border rounded-lg bg-card">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            Email Support
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Our team typically responds within 24-48 hours.
          </p>
          <Button asChild>
            <Link href="mailto:sultanbusiness2026@gmail.com">
              sultanbusiness2026@gmail.com
            </Link>
          </Button>
        </div>

        <div className="text-sm text-muted-foreground pt-8 border-t">
          <p>
            For legal inquiries, please review our{' '}
            <Link href="/legal/terms" className="underline hover:text-primary">Terms</Link> or{' '}
            <Link href="/legal/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}