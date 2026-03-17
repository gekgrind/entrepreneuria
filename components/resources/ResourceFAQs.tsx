"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { useState } from "react"

const FAQS = [
  {
    q: "What resources are free?",
    a: "Templates like Lean Canvas, pitch deck outline, and starter checklists are free.",
  },
  {
    q: "Are these resources beginner-friendly?",
    a: "Yes—guides are designed for first-time founders and seasoned entrepreneurs alike.",
  },
  {
    q: "Can I use these resources for teaching?",
    a: "Yes—educators are encouraged to use Entrepreneuria resources in classes or workshops.",
  },
  {
    q: "Do premium plans include extra resources?",
    a: "Yes—Growth & Pro plans include advanced toolkits and playbooks.",
  },
  {
    q: "How often are new resources added?",
    a: "Monthly, with updates announced via newsletter.",
  },
]

export default function ResourceFAQs() {
  const [openFaq, setOpenFaq] = useState<string | undefined>(undefined)

  return (
    <Card className="max-w-3xl mx-auto bg-card border-2 border-primary p-8">
      <Accordion type="single" collapsible value={openFaq} onValueChange={setOpenFaq}>
        {FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-card-foreground hover:text-primary">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  )
}
