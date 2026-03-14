import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const FAQPage = () => {
  const { language } = useLanguageStore();

  const faqs = [
    {
      question: 'How does payment work?',
      answer:
        'When you book an ad, your payment is held securely in escrow. Once the supplier delivers proof and you approve it, the funds are released to them minus our 10% platform fee.',
    },
    {
      question: 'What if I\'m not satisfied with the delivery?',
      answer:
        'You can dispute the order through our platform. Our mediation team will review the evidence from both sides and make a fair decision. Refunds are issued for justified disputes.',
    },
    {
      question: 'How are suppliers verified?',
      answer:
        'All suppliers undergo identity verification (for individuals) or business verification (for companies). We check ID documents, social media authenticity, and request portfolio samples.',
    },
    {
      question: 'How long does booking take?',
      answer:
        'Most bookings can be completed in under 5 minutes. After you book, suppliers typically respond within 24 hours to confirm or negotiate details.',
    },
    {
      question: 'Can I book multiple suppliers at once?',
      answer:
        'Yes! Our Campaign Builder lets you select a mix of influencers, billboards, and other inventory types in a single checkout. This is ideal for multi-channel campaigns.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept debit/credit cards, bank transfers, and USSD payments through our partner Paystack. All transactions are secure and PCI-compliant.',
    },
    {
      question: 'Do you charge listing fees?',
      answer:
        'No. Suppliers can list their services for free. We only charge a 10% platform fee when a transaction is completed.',
    },
    {
      question: 'Is the platform available in Hausa?',
      answer:
        'Yes! Toggle between English and Hausa using the language button in the top navigation. Your preference is saved for future visits.',
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50" data-testid="faq-page">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('footer.faq', language)}</h1>
          <p className="text-lg text-muted-foreground">Answers to common questions about Lightban</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="bg-white border rounded-lg px-6"
              data-testid={`faq-item-${idx}`}
            >
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};
