import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t py-6">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} QuizCraft. All rights reserved.</p>
        <div className="mt-2">
          <span>Contact Support: </span>
          <Link 
            href="mailto:sultanbusiness2026@gmail.com" 
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            sultanbusiness2026@gmail.com
          </Link>
        </div>
      </div>
    </footer>
  );
}