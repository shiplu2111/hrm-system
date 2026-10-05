import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Section';

export function CtaBanner({
  title = 'Ready to simplify HR and payroll?',
  description = 'See CMSN-HR with your own policies in a 30-minute walkthrough, or pick a plan and get your workspace today.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-brand-800 px-8 py-14 text-center shadow-elevated sm:px-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
            aria-hidden
          />
          <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-brand-100">{description}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/pricing" variant="white" size="lg">
              See pricing
            </ButtonLink>
            <ButtonLink
              href="/contact?topic=demo"
              size="lg"
              className="border border-white/30 bg-transparent text-white shadow-none hover:bg-white/10"
            >
              Book a demo
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
