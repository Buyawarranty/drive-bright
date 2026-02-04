import { useEffect } from 'react';

interface HowToStep {
  name: string;
  text: string;
  url?: string;
  image?: string;
}

interface HowToSchemaProps {
  name: string;
  description: string;
  steps: HowToStep[];
  totalTime?: string;
  estimatedCost?: {
    currency: string;
    value: string;
  };
  image?: string;
}

export const HowToSchema = ({
  name,
  description,
  steps,
  totalTime = 'PT5M',
  estimatedCost,
  image = 'https://buyawarranty.co.uk/lovable-uploads/53652a24-3961-4346-bf9d-6588ef727aeb.png'
}: HowToSchemaProps) => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": name,
      "description": description,
      "image": image,
      "totalTime": totalTime,
      ...(estimatedCost && {
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": estimatedCost.currency,
          "value": estimatedCost.value
        }
      }),
      "step": steps.map((step, index) => ({
        "@type": "HowToStep",
        "position": index + 1,
        "name": step.name,
        "text": step.text,
        ...(step.url && { "url": step.url }),
        ...(step.image && { "image": step.image })
      }))
    };

    const scriptId = 'howto-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (script) {
      script.textContent = JSON.stringify(schema);
    } else {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [name, description, steps, totalTime, estimatedCost, image]);

  return null;
};

// Default claims process steps
export const defaultClaimsSteps: HowToStep[] = [
  {
    name: "Diagnose the Issue",
    text: "Take your vehicle to any approved garage for diagnosis. The technician will identify the fault and provide an estimate."
  },
  {
    name: "Contact Us for Authorisation",
    text: "Call our UK-based claims team on 0330 229 5040. We'll review the diagnosis and authorise the repair quickly."
  },
  {
    name: "Get Your Vehicle Repaired",
    text: "Once authorised, the garage completes the repair using quality parts. You only pay any applicable excess."
  },
  {
    name: "We Pay the Garage Directly",
    text: "We settle the invoice directly with the garage. No upfront costs, no claim forms, no waiting for reimbursement."
  }
];
