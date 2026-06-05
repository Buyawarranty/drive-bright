import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, MessageCircle, Phone, Mail, Menu, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SEOHead } from '@/components/SEOHead';
import { FAQSchema } from '@/components/schema/FAQSchema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import pandaSavingsFaq from '@/assets/panda-savings-faq.png';
import { OptimizedImage } from '@/components/OptimizedImage';
import trustpilotBadge from '@/assets/trustpilot-badge.png';
import TrustpilotMicroStarWidget from '@/components/TrustpilotMicroStarWidget';

const FAQ = () => {
  const navigate = useNavigate();
  
  const navigateToQuoteForm = () => {
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('quote-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAIAnswer, setShowAIAnswer] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [relatedQuestions, setRelatedQuestions] = useState<any[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Common search suggestions based on popular queries
  const commonSearches = [
    'How much does it cost?',
    'What is covered?',
    'How to make a claim?',
    'Electric vehicle warranty',
    'Can I use my own garage?',
    'How to cancel warranty?',
    'Breakdown cover',
    'Service requirements'
  ];

  // Enhanced search suggestions with scoring and instant access
  const getSearchSuggestions = (query: string) => {
    if (!query.trim()) return commonSearches.slice(0, 6);
    
    const lowerQuery = query.toLowerCase();
    const results = [];
    
    // First, check common searches
    const matchingCommon = commonSearches.filter(search => 
      search.toLowerCase().includes(lowerQuery)
    ).map(question => ({ question, type: 'common', score: 10 }));
    
    // Then check all FAQ questions with scoring
    const allQuestions = faqData.flatMap(category => 
      category.questions.map(q => ({
        ...q,
        category: category.category,
        categoryId: category.id
      }))
    );
    
    const matchingQuestions = allQuestions
      .map(q => {
        const questionLower = q.question.toLowerCase();
        const answerLower = q.answer.toLowerCase();
        
        let score = 0;
        
        // Exact question match gets highest score
        if (questionLower === lowerQuery) score = 100;
        // Question starts with query
        else if (questionLower.startsWith(lowerQuery)) score = 80;
        // Question contains query at word boundary
        else if (questionLower.includes(` ${lowerQuery}`)) score = 60;
        // Question contains query anywhere
        else if (questionLower.includes(lowerQuery)) score = 40;
        // Answer contains query
        else if (answerLower.includes(lowerQuery)) score = 20;
        
        // Boost popular questions
        if (q.popular) score += 15;
        
        return { ...q, type: 'faq', score };
      })
      .filter(q => q.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    
    // Combine and limit results
    return [...matchingCommon, ...matchingQuestions]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(value.length > 0);
  };

  const handleSuggestionClick = (suggestion: any) => {
    if (typeof suggestion === 'string') {
      // Handle common searches
      setSearchTerm(suggestion);
      setShowSuggestions(false);
    } else {
      // Handle FAQ suggestions - scroll to and open the FAQ item
      setSearchTerm(suggestion.question);
      setShowSuggestions(false);
      
      // Scroll to category first
      setTimeout(() => {
        const categoryElement = document.getElementById(suggestion.categoryId);
        if (categoryElement) {
          categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Then open the specific FAQ item
          setTimeout(() => {
            setOpenItems(prev => ({
              ...prev,
              [suggestion.id]: true
            }));
            
            // Scroll to the specific FAQ item
            const faqElement = document.getElementById(suggestion.id);
            if (faqElement) {
              faqElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }
      }, 100);
    }
  };

  const findRelatedQuestions = (query: string) => {
    const keywords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const allQuestions = faqData.flatMap(category => 
      category.questions.map(q => ({ ...q, category: category.category }))
    );
    
    const related = allQuestions.filter(q => {
      const questionText = (q.question + ' ' + q.answer).toLowerCase();
      return keywords.some(keyword => questionText.includes(keyword));
    }).slice(0, 3);
    
    return related;
  };

  // Helper function to render text with clickable links
  const renderAnswerWithLinks = (text: string) => {
    // Split text by URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            className="text-brand-orange hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const faqData = [
    {
      category: 'Getting Started',
      id: 'getting-started',
      questions: [
        {
          id: 'what-is-warranty',
          question: 'What\'s a car warranty and why should I get one?',
          answer: 'Think of a warranty as a backup plan for your car. If something goes wrong – like a mechanical or electrical fault – your warranty helps cover the cost of repairs. New cars usually come with a manufacturer\'s warranty for about 3 years. After that, you\'re on your own unless you get an extended warranty. That\'s where we come in – giving you peace of mind and helping you avoid surprise bills.',
          popular: true
        },
        {
          id: 'why-extended-warranty',
          question: 'Why bother with an extended warranty?',
          answer: 'Once your manufacturer\'s warranty runs out, you\'re responsible for any repairs. Our extended warranty helps protect you from unexpected costs – whether it\'s a breakdown, electrical fault or something else. We also include extras like roadside recovery, car hire and onward travel. It\'s all about making life easier and less stressful when things go wrong.'
        },
        {
          id: 'choose-right-plan',
          question: 'How do I choose the right plan for my car?',
          answer: 'We\'ll help you pick a plan that suits your car\'s age, mileage and how you use it. Whether you drive a little or a lot, we\'ve got options to match. Feel free to WhatsApp us using the icon or call us on 0330 229 5040 we\'ll be happy to help'
        },
        {
          id: 'older-high-mileage',
          question: 'Do You Cover Older or High Mileage Vehicles?',
          answer: 'Absolutely. Unlike many other warranty providers, we\'re here to help you protect more vehicles, for longer:\n✅ Cover for vehicles up to 15 years old\n ✅ Cover for vehicles with up to 150,000 miles\n ✅ Flexible plans for 12, 24, or 36 months'
        },
        {
          id: 'used-car-when-to-buy',
          question: 'Can I buy a warranty for a used car, and when should I get it?',
          answer: 'Yes, absolutely! We specialise in providing comprehensive extended warranties specifically for used cars. It is highly recommended that you buy a warranty as soon as your manufacturer\u2019s warranty expires, or immediately after purchasing a used vehicle privately or from a dealership. This ensures you avoid unexpected, costly mechanical or electrical repair bills from day one.'
        }
      ]
    },
    {
      category: 'Making Claims',
      id: 'making-claims',
      questions: [
        {
          id: 'car-issue',
          question: 'What should I do if my car has an issue?',
          answer: 'If your car experiences a problem, please contact our Claims Team at 0330 229 5045. They are available Monday to Friday from 09:00 to 17:30 and can help start and process your warranty claim. If the issue arises outside of these hours, please fill out our online contact form at www.buyawarranty.co.uk/make-a-claim',
          popular: true
        },
        {
          id: 'how-make-claim',
          question: 'How do I make a claim?',
          answer: 'Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It\'s important to note that failure to do so will not allow us to process your claim.',
          popular: true
        },
        {
          id: 'easy-claim-repair',
          question: 'Is it easy to make a claim and get my repair done?',
          answer: 'Yes, absolutely – we\'ve made it simple and hassle-free:\n\n* Follow a few quick steps to start your claim\n* We guide you through the process from start to finish\n* Repairs are handled quickly and professionally\n* Choose your own garage or use our trusted network\n* Payouts are usually processed within 90 minutes of approval\n\nHow it works:\n\n1. Contact Us – Call 0330 229 5045 or use our online claims form\n2. Fast Repairs – We review your claim the same day (during office hours)\n3. Payment – We pay the garage directly, or reimburse you promptly with a valid invoice\n\nOur goal is to get you back on the road quickly and with minimal fuss. No stress, no hassle – just quick and smooth authorisation every time.'
        },
        {
          id: 'do-you-pay-claims',
          question: 'Do we actually pay out claims?',
          answer: 'It\'s a fair question - and the answer is yes. We genuinely value our customers, and when something goes wrong, we don\'t look for loopholes. We look for reasons to say yes.\n\nWith easy-to-follow terms, we\'re committed to giving you reliable protection and peace of mind.'
        },
        {
          id: 'pay-upfront',
          question: 'Do I have to pay the garage upfront and then seek reimbursement from you',
          answer: 'No, in most cases we can pay the garage directly for authorised repairs via bank transfer, so you\'re not out of pocket.\nHowever, if your chosen garage isn\'t able or willing to deal directly with a warranty company, you can pay for the repair yourself and send us the invoice. Once we\'ve approved your claim and received a valid invoice, we\'ll reimburse you promptly- no delays or complications.'
        },
        {
          id: 'how-much-pay',
          question: 'How much do I need to pay?',
          answer: 'When your claim is authorised, it will be for a specific amount agreed with your chosen repair garage. Here\'s how it works:\n\n* If you\'re within your claim limit, and the parts and labour are covered by your plan, you won\'t have to pay anything.\n* You may need to pay any warranty excess, the cost of parts not covered by your plan, or any amount above your claim limit.\n\nThis way, you\'re always clear on what\'s covered and what (if anything) you\'ll need to pay.'
        },
        {
          id: 'vehicle-inspection',
          question: 'Is a vehicle inspection necessary before I can make a claim?',
          answer: 'In certain situations, we may need to inspect your vehicle before validating your claim.'
        },
        {
          id: 'first-claim-timing',
          question: 'When can I make my first claim?',
          answer: '* You can make your first claim 30 days after you buy your plan, unless you already had an active warranty with us.\n* If you\'re renewing or moving from one of our plans to another with continuous cover, you can claim straight away.\n* For example: If you buy your plan today and a warning light appears after one week, you\'ll be able to make a claim once 30 days have passed.'
        },
        {
          id: 'no-service-history',
          question: 'What if I don\'t have a full service history?',
          answer: 'No problem. If you don\'t have a complete service history, you can get a full service done now and then contact us about your claim.\nThis way, you\'re still eligible for cover and can claim with confidence.'
        },
        {
          id: 'thirty-day-wait',
          question: 'Is there a 30‑day wait for new customers?',
          answer: 'No - your cover begins immediately. As long as there are no pre‑existing faults on the vehicle, you\'re protected from the moment your warranty starts. The only things we can\'t cover are issues that were already present before the plan began.'
        }
      ]
    },
    {
      category: 'Coverage Details',
      id: 'coverage-details',
      questions: [
        {
          id: 'whats-covered-warranty',
          question: 'What\'s covered in my warranty?',
          answer: 'At Buy-a-Warranty, we like to keep things simple. One solid plan that works for cars, vans, and motorbikes, whether you\'re driving electric, hybrid, petrol, or diesel.\n\nWe keep things simple with no confusing packages\nYou won\'t encounter any unexpected rejections\nWe offer straightforward cover without the hassle\nClear, easy-to-understand protection\n\nBecause maintaining your vehicle shouldn\'t be a headache.',
          popular: true
        },
        {
          id: 'whats-included-warranty',
          question: 'What\'s included in my warranty?',
          answer: 'Our Platinum Plan comes as standard and includes:\n\n✅ All mechanical and electrical parts covered\n ✅ Labour costs included\n ✅ Fault diagnostics\n ✅ Consequential damage cover\n ✅ Access to trusted repair centres or your own garage\n\nFor full details, please visit our \'What\'s covered\' page.\n Some limits apply – please see the Platinum Warranty Plan details in the \'What\'s covered\' section of the website.'
        },
        {
          id: 'components-covered',
          question: 'What components are covered?',
          answer: 'Our warranty covers a wide range of parts and systems, including:\n\n✅ All mechanical and electrical parts\n ✅ Labour costs included\n ✅ Engine, gearbox, drivetrain, turbocharger\n ✅ Fuel systems, cooling, exhaust, brakes, suspension, steering\n ✅ Air conditioning, electrical systems, ECUs, sensors, lighting\n ✅ Multimedia, driver assistance, safety systems\n ✅ Hybrid & PHEV: hybrid drive motors, batteries, inverters, regenerative braking, high-voltage components\n ✅ Electric vehicles: drive motors, high-voltage battery, inverters, chargers, thermal systems\n ✅ Motorcycles: engine/motor, gearbox, ECUs, electrical systems, suspension, brakes, cooling, lighting, instrumentation\n ✅ And more…\n\nFor full details, please see our \'What\'s covered\' section. https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'petrol-diesel-parts',
          question: 'What parts are covered for my petrol or diesel car or van?',
          answer: 'Our warranty covers a wide range of important parts and systems. Here are just some of the components included:\n✅ Engine & internal components (pistons, valves, camshafts, timing chains, seals, gaskets)\n ✅ Gearbox / transmission systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes)\n ✅ Drivetrain & clutch assemblies (flywheel, driveshafts, differentials)\n ✅ Turbocharger & supercharger units\n ✅ Fuel delivery systems (tanks, pumps, injectors, fuel rails, fuel control electronics)\n ✅ Cooling & heating systems (radiators, thermostats, water pumps, cooling fans, heater matrix)\n ✅ Exhaust & emissions systems (catalytic converters, DPFs, OPFs, EGR valves, NOx)\n ✅ And more…\n\nFor full details, please see our \'What\'s covered\' section. https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'hybrid-phev-parts',
          question: 'What parts are covered for Hybrid & PHEV Vehicle?',
          answer: 'Our warranty covers a wide range of important hybrid and plug-in hybrid components, including:\n✅ All petrol/diesel engine parts and labour\n ✅ Hybrid drive motors & ECUs\n ✅ Hybrid battery failure\n ✅ Power control units, inverters & DC-DC converters\n ✅ Regenerative braking systems\n ✅ High-voltage cables & connectors\n ✅ Cooling systems for hybrid components\n ✅ Charging ports & on-board charging modules\n ✅ Hybrid transmission components\n ✅ Braking systems (ABS, calipers, cylinders, master cylinders)\n ✅ Suspension & steering systems (shocks, struts, steering racks, power/electric steering pumps, electronic suspension)\n ✅ Air conditioning & climate control systems\n ✅ Electrical components & charging systems (alternators, starter motors, wiring looms, connectors, relays)\n ✅ Electronic control units (ECUs) & sensors (engine management, ABS, traction control, emissions sensors)\n ✅ Lighting & ignition systems (headlights, indicators, ignition coils, switches, control modules)\n ✅ Factory-fitted multimedia & infotainment systems (screens, sat nav, audio, digital displays)\n ✅ Driver assistance systems (adaptive cruise control, lane assist, steering assist, parking sensors, reversing cameras)\n ✅ Safety systems (airbags, seatbelts, pretensioners, safety restraint modules)\n ✅ And more…\nFor the full list of covered parts and all the details, please visit our \'What\'s covered\' page.\n\nFor full details, please see our \'What\'s covered\' section. https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'electric-vehicle-parts',
          question: 'What\'s covered for Electric Vehicles (EVs)?',
          answer: 'Our warranty covers a wide range of essential EV components. Here are just some of the parts included:\n\n✅ EV drive motors & reduction gear\n ✅ EV transmission & reduction gearbox assemblies\n ✅ High-voltage battery failure\n ✅ Power control units & inverters\n ✅ On-board charger (OBC) & charging ports\n ✅ DC-DC converters\n ✅ Thermal management systems\n ✅ High-voltage cables & connectors\n ✅ EV-specific control electronics\n ✅ Regenerative braking system components\n ✅ And more…\n\nFor full details, please see our \'What\'s covered\' section. https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'motorbike-parts',
          question: 'What parts are covered for my motorbike?',
          answer: 'Our warranty covers a wide range of key motorcycle components. Here are just some of the parts included:\n✅ Engine / motor & drivetrain components\n ✅ Gearbox / transmission systems\n ✅ ECUs, sensors & control modules\n ✅ Electrical systems & wiring\n ✅ High-voltage battery failure (hybrid & EV)\n ✅ Suspension & steering systems\n ✅ Braking systems\n ✅ Cooling & thermal systems\n ✅ Lighting & ignition systems\n ✅ Instrumentation & rider controls\n ✅ And more…\n\nFor full details, please see our \'What\'s covered\' section. https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'optional-extras',
          question: 'What optional extras do you offer?',
          answer: 'Here\'s your list with brief descriptions for each benefit:\n\n* Vehicle rental – Get a courtesy vehicle while your car is being repaired, so you\'re never left stranded.\n* Wear & tear cover – Protection for certain parts that fail due to normal use, not just sudden breakdowns.\n* Tyre replacement cover – Covers the cost of replacing tyres damaged by punctures or road hazards.\n* European repair cover – Enjoy warranty protection even when driving in Europe.\n* Breakdown recovery – Roadside recovery claim-back to get you moving again if your car breaks down.\n* Transferable warranty – If you sell your car, you can transfer the remaining warranty to the new owner.\n\nFor full details on what\'s included, visit our https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'what-not-covered',
          question: 'What\'s not covered?',
          answer: 'What\'s Not Included:\n\n* Pre-existing faults\n* Routine servicing or maintenance (e.g. fluids, tyres, brake pads)\n* Vehicles used for hire or reward (e.g. taxi, rental, courier)\n* Accident or collision damage\n* Indirect or knock-on financial losses (e.g. hotel bookings, lost earnings)'
        },
        {
          id: 'what-covered',
          question: 'What does your warranty cover?',
          answer: 'Our plans cover a wide range of parts – from the engine and gearbox to electrical systems and more. We offer the most comprehensive warranty plan for our customers to ensure that you get the most cover.\n\nFor full details on what\'s included, visit our https://buyawarranty.co.uk/what-is-covered',
          popular: true
        },
        {
          id: 'not-covered',
          question: 'Are there items that aren\'t covered?',
          answer: 'Yes, some items like wear-and-tear items (e.g. tyres, brake pads) unless you take the add-on option for wear and tear, tyre cover etc or damage from accidents are not included. We\'ll always be upfront about what\'s covered and what\'s not, so there are no surprises.'
        },
        {
          id: 'wear-tear',
          question: 'Does my warranty cover wear and tear?',
          answer: 'Warranty plans are designed to cover unexpected faults and failures, rather than items that naturally wear out over time. Even manufacturer warranties on brand-new cars don\'t include normal wear and tear.\nHowever, for extra peace of mind, we offer wear & tear cover as an optional add-on. You can select this additional protection when purchasing your warranty—just look for the option on the pricing page.\nFor full details on what\'s included and available add-ons, please visit our \'What\'s covered\' page.'
        },
        {
          id: 'diagnostic-charges',
          question: 'Does my warranty cover diagnostic charges?',
          answer: 'The warranty does cover diagnostic charges. We also cover physical dismantling charges in the event of a valid claim, subject to the warranty\'s maximum claim limit.'
        },
        {
          id: 'mechanical-electrical',
          question: 'What counts as mechanical or electrical parts?',
          answer: 'Mechanical parts are things like your engine, gearbox and suspension. Electrical parts include your car\'s wiring, sensors, and tech systems. We\'ll explain exactly what\'s covered in your plan.'
        },
        {
          id: 'claim-limit-choice',
          question: 'What claim limit is right for me?',
          answer: 'It depends on your vehicle and how much protection you want.\n\n£1,000 is ideal for smaller or lower‑cost repairs.\n£2,000 offers broader cover for most mid‑range repairs.\n£3,000 is our most popular option and covers the majority of common faults in full.\n£5,000 provides our highest level of protection and is best suited to newer, higher‑value or more complex vehicles where repair costs can be significantly higher.\n\nEvery plan includes unlimited claims, and you\'re covered up to the value of your vehicle, whichever limit you choose.'
        },
        {
          id: 'repair-limits',
          question: 'What are the repair limits?',
          answer: 'We\'ll cover repairs up to the claim limit you chose when you signed up.'
        },
        {
          id: 'increase-claim-limit-for-claim',
          question: 'Can I increase my claim limit for a claim?',
          answer: 'If you decide you want a higher claim limit. You can call 0330 229 5040 or email support@buyawarranty.co.uk to upgrade. The higher limit will apply to any future approved claims after the upgrade is confirmed.'
        },
        {
          id: 'unlimited-repairs',
          question: 'Are repairs unlimited on unlimited plans?',
          answer: 'Repairs are covered up to the original purchase price of your vehicle, giving you ongoing protection for as long as your plan is active.'
        },
        {
          id: 'outside-terms',
          question: 'What if something falls outside these terms, do you reject claims?',
          answer: 'We get that life isn\'t always black and white. If something falls outside these terms, we\'ll still look at it fairly and help where we can.'
        },
        {
          id: 'high-performance-cover',
          question: 'Can I get cover for a high performance or high end vehicle?',
          answer: 'Some vehicles like Range Rover, BMW M/7 Series, Audi RS, Mercedes-AMG, Porsche, Jaguar, and Maserati may not be eligible due to specialist parts and higher repair costs. Please check our vehicle eligibility guide at: https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'high-performance-purchased',
          question: 'What if I buy a warranty and my high performance or high end vehicle isn\'t eligible?',
          answer: 'If your vehicle falls into a restricted category, we\'ll cancel your policy and issue a full refund in line with our terms.'
        },
        {
          id: 'check-vehicle-qualifies',
          question: 'How do I check if my vehicle qualifies before buying?',
          answer: 'If you\'re unsure, please check our vehicle eligibility guide at: https://buyawarranty.co.uk/what-is-covered'
        },
        {
          id: 'car-too-old',
          question: 'Is my car too old or too many miles?',
          answer: 'We cover many older and higher mileage vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm.',
          popular: true
        },
        {
          id: 'modified-vehicles',
          question: 'What about modified vehicles?',
          answer: 'Most body modifications are accepted. Call us on 0330 229 5040 or request a call back using the Call us button in the top navigation bar.'
        },
        {
          id: 'most-expensive-repair',
          question: 'What is the most expensive repair you have covered?',
          answer: 'We regularly cover repairs over £1,500 for engines, gearboxes and ECUs. Higher claim limits are available. Check your instant price by entering your registration.'
        },
        {
          id: 'service-history-needed',
          question: 'Do I need a full service history?',
          answer: 'A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed.'
        },
        {
          id: 'diagnostics-covered',
          question: 'Are diagnostics covered?',
          answer: 'Diagnostics are usually covered when the fault is approved.'
        },
        {
          id: 'uk-wide-cover',
          question: 'Is your car warranty cover valid across the entire UK?',
          answer: 'Yes, all of our car warranty plans offer complete coverage across England, Scotland, Wales, and Northern Ireland. If your vehicle breaks down anywhere in the UK, you can take it to any VAT-registered garage nationwide, or utilise our network of approved repair specialists to get you back on the road quickly.'
        },
        {
          id: 'limited-warranty-meaning',
          question: 'What does a "limited warranty" actually cover?',
          answer: 'A limited warranty means that coverage is restricted to specific parts, timeframes, or conditions listed in the policy, rather than covering "everything." For example, a manufacturer\u2019s limited warranty typically protects against factory defects in materials or workmanship but explicitly excludes everyday wear-and-tear items (like brake pads, tyres, and wiper blades), routine servicing, and damage from accidents or neglect. Our policies clearly define these limits upfront so you always know exactly what is protected.'
        }
      ]
    },
    {
      category: 'Garages & Repairs',
      id: 'garages-repairs',
      questions: [
        {
          id: 'preferred-garage',
          question: 'Can I use my preferred garage for repairs?',
          answer: 'You can use your own garage, including main dealers or local independents, as long as they\'re VAT registered. If the repair cost goes over your claim limit, you may need to pay the difference (top up the extra amount).'
        },
        {
          id: 'own-garage',
          question: 'Can I use my own garage?',
          answer: 'Absolutely – as long as they\'re VAT-registered and follow our repair guidelines. We want you to feel comfortable with who\'s working on your car.'
        },
        {
          id: 'breakdown-hours',
          question: 'What if I break down outside office hours or on holiday?',
          answer: 'Our office hours are 9am to 5:30pm, Monday to Friday. If you break down outside these hours, you can still take your vehicle to a garage and ask them to contact us on Monday morning. If it\'s the weekend, you can also complete the claim form online. Please note, we\'re only able to make payments and authorise repairs between 9am and 5:30pm, Monday to Friday—so please don\'t start any work without our go-ahead.'
        },
        {
          id: 'hire-car',
          question: 'Will you cover the cost of a hire car?',
          answer: 'If your car\'s off the road due to a covered fault, we can help with car hire costs. It\'s one of the handy extras included in many of our plans.'
        },
        {
          id: 'breakdown-abroad',
          question: 'Can I get help if I break down abroad?',
          answer: 'Yes – we offer European cover claim back with some of our plans. Just let us know where you\'re going and we\'ll make sure you\'re protected.'
        }
      ]
    },
    {
      category: 'Service & Maintenance',
      id: 'service-maintenance',
      questions: [
        {
          id: 'service-car',
          question: 'Do I need to get my vehicle serviced?',
          answer: 'Yes, you do. It is important to adhere to the manufacturer\'s recommendations for servicing at the correct times/mileages after taking delivery of the vehicle. The service does not necessarily have to be completed by a main dealer unless you want to maintain a full dealer history, but it is important to retain relevant receipts as proof.'
        },
        {
          id: 'service-regularly',
          question: 'Do I need to service my car regularly?',
          answer: 'Yes please! Keeping up with your car\'s servicing schedule helps keep your warranty valid. Just follow the manufacturer\'s guidelines and keep your receipts.'
        },
        {
          id: 'service-before-warranty',
          question: 'Do I need to service my car before getting a warranty?',
          answer: 'If your car\'s service history is up to date, you\'re good to go. If it\'s missing a service, you\'ll need to get that done before your cover starts. Just follow the manufacturer\'s servicing schedule and keep your receipts.'
        },
        {
          id: 'missed-service',
          question: 'What if the previous owner missed a service?',
          answer: 'No worries – you\'ll just need to get the vehicle serviced properly before your warranty kicks in. It\'s all about making sure your vehicle\'s in good shape from the start.'
        },
        {
          id: 'inspection-required',
          question: 'Do I need an inspection before buying a plan?',
          answer: 'No – we don\'t require a vehicle inspection. Just make sure your car meets the basic eligibility criteria.'
        },
        {
          id: 'mileage-limit',
          question: 'What mileage limit applies?',
          answer: 'Your vehicle should not exceed 2,000 miles per month.'
        },
        {
          id: 'servicing-requirements',
          question: 'What are the servicing requirements?',
          answer: 'A full service history is needed, if you don\'t have that simply get a full service within 30 days of starting your plan e.g You book a full service within 30 days because you do not have a full service history. Once the service is done and the 30 days have passed, you can make your first claim if needed.'
        }
      ]
    },
    {
      category: 'Plans & Pricing',
      id: 'plans-pricing',
      questions: [
        {
          id: 'how-long-cover',
          question: 'How long can I get cover for?',
          answer: 'You can choose a plan that suits you – pay in full and save more money, spread it over 12 months interest free, or go for monthly Pay As You Go. We\'re flexible.'
        },
        {
          id: 'change-mind',
          question: 'What if I change my mind after buying?',
          answer: 'No problem. You\'ve got a cooling-off period (usually 14 days) to cancel for a full refund, as long as you haven\'t made a claim.'
        },
        {
          id: 'cancellation-rights',
          question: 'What are my cancellation rights?',
          answer: 'You can cancel within 14 days of purchase for a full refund, as long as no repairs have been made. After 14 days, our standard cancellation policy applies. However, if you\'ve set up a payment plan with one of our lenders, unfortunately refunds after 14 days aren\'t possible, as you\'ll be in a contract for your warranty plan. Take your time there\'s no pressure to decide right away.'
        },
        {
          id: 'cancel-warranty',
          question: 'How do I cancel my warranty?',
          answer: 'You have 14 days to cancel your warranty. We understand that circumstances may change, and you may no longer require the warranty purchased from Buyawarranty.co.uk. If you wish to cancel your warranty, please reach out to us at support@buyawarranty.co.uk or call us on 0330 229 5045.'
        },
        {
          id: 'transferable',
          question: 'Is the warranty transferable?',
          answer: 'Yes, our warranties can be transferred to a new owner if you sell your car privately—this can help you sell your vehicle and may even increase its value. There\'s a £19.99 fee if you choose to transfer the warranty at the time of purchase. If you decide to transfer it later, the fee is £30, so it\'s worth sorting early for the best deal. To transfer your warranty, just get in touch with us using the contact form.'
        },
        {
          id: 'transfer-warranty-new-vehicle',
          question: 'Can I transfer my warranty to another vehicle?',
          answer: 'Got a new car or selling your car? Your warranty plan may be transferred with a small fee if a replacement vehicle is of a vehicle type that we provide warranty for i.e most vehicles. You may check eligibility by entering the registration plate into our homepage. Please email support@buyawarranty.co.uk to transfer your warranty or choose the option from the pricing page when you purchase your warranty.'
        },
        {
          id: 'cancel-warranty-detailed',
          question: 'Can I cancel my warranty?',
          answer: 'You have 14 days to cancel your warranty for a full refund for FREE (if no repairs have been made). After this period, our standard easy to follow cancellation policy applies. Simply visit https://buyawarranty.co.uk/cancel-warranty/'
        },
        {
          id: 'cheapest-good-cover',
          question: 'Where can I find the cheapest car warranty that still offers good coverage?',
          answer: 'While it\u2019s tempting to look purely for the "cheapest" car warranty, the lowest price often means high hidden excesses or essential parts being excluded. At Buyawarranty.co.uk, we focus on providing the best value in the UK \u2014 combining highly competitive, affordable pricing with comprehensive cover that actually pays out when you need it. We offer flexible payment plans to break down the cost into manageable monthly payments.'
        },
        {
          id: 'standard-vehicle-types',
          question: 'What types of vehicles are covered under your standard vehicle warranty?',
          answer: 'Our standard vehicle warranty options cover a vast range of makes and models across the UK. Whether you are looking to buy a car warranty for a family hatchback, a premium SUV (like a Range Rover), a performance saloon, or even alternative vehicles like motorbikes and vans, we have a plan for you. We cover everything from major engine and gearbox components to intricate electrical systems, depending on the tier of cover you select for your vehicle.'
        }
      ]
     },
    {
      category: 'Brand-Specific Extended Cover',
      id: 'brand-specific-cover',
      questions: [
        {
          id: 'audi-extended-warranty',
          question: 'Do you offer specialist cover like an Audi extended warranty?',
          answer: 'Yes. We offer premium vehicle warranties tailored for high-end and German vehicles, including comprehensive Audi extended warranty coverage. Because parts and diagnostic labour rates for luxury brands like Audi can be incredibly expensive, our policies are designed to cover advanced electrical components, DSG/S-tronic gearboxes, and engine management systems to give you total peace of mind.'
        },
        {
          id: 'mercedes-cost',
          question: 'How much does a Mercedes extended warranty cost?',
          answer: 'The cost of a Mercedes extended warranty depends entirely on your vehicle\'s age, mileage, and the level of cover you choose. Because Mercedes-Benz vehicles feature complex technology like AIRMATIC suspension, MBUX infotainment systems, and precision engineering, main dealer repairs can be incredibly expensive. At Buyawarranty.co.uk, we provide tailored, dealer-level cover for Mercedes models at a fraction of the cost of a manufacturer policy. Get a quick quote online today to see your exact price.'
        },
        {
          id: 'used-mercedes',
          question: 'Can I get an extended warranty for a used Mercedes-Benz?',
          answer: 'Yes, we provide comprehensive extended warranty protection specifically tailored for used Mercedes-Benz vehicles. Buying a pre-owned Mercedes is exciting, but out-of-warranty repair costs for premium AMG lines, complex 4MATIC systems, or electrical command modules can be exceptionally high. Our used Mercedes policies are designed to pick up where the original manufacturer warranty left off, protecting your wallet from sudden mechanical or electrical failures at a fraction of the cost of main dealer prices.'
        },
        {
          id: 'vw-extended-warranty',
          question: 'Do you offer a VW extended warranty for Volkswagen vehicles?',
          answer: 'Yes, we offer comprehensive component protection for all major Volkswagen models, including the Golf, Polo, Tiguan, and Passat. Our VW extended warranty covers major mechanical and electrical failures\u2014including common DSG gearbox issues, turbocharger faults, and advanced driver assistance systems (ADAS)\u2014ensuring your vehicle remains reliable without breaking the bank.'
        },
        {
          id: 'vw-extended-covers',
          question: 'What does a VW extended warranty cover?',
          answer: 'Our Volkswagen extended warranty is designed to mimic factory-level protection for peace of mind. It covers sudden mechanical and electrical failures across major VW assemblies. This includes the engine, fuel injection systems, cooling system, and steering. Crucially for VW owners, our premium plans provide vital coverage for complex Volkswagen technologies, such as DSG/automatic gearboxes, turbochargers, and on-board infotainment systems, using any VAT-registered garage across the UK.'
        },
        {
          id: 'land-rover-prices',
          question: 'What are the Land Rover and Range Rover extended warranty prices in the UK?',
          answer: 'Land Rover and Range Rover extended warranty prices vary depending on your vehicle\'s age, mileage, and specific model (such as a Sport, Evoque, or Defender). Because luxury SUVs feature highly advanced 4x4 drivetrains, air suspension setups, and premium electronics, main dealer repair costs are notoriously steep. At Buyawarranty.co.uk, we provide equivalent main-dealer level protection for Land Rovers at a significantly lower rate. Get an instant quote online to view our current tiered pricing packages.'
        },
        {
          id: 'hyundai-cost',
          question: 'How much does a Hyundai extended warranty cost?',
          answer: 'Hyundai vehicles are known for their reliability, but as they age past their original 5-year manufacturer warranty, components like complex infotainment screens, fuel injection systems, and automatic transmissions can still fail. The cost of a Hyundai extended warranty with us is highly affordable and tailored to your vehicle\'s specific mileage. It is designed to offer maximum protection for a fraction of the cost of a single major garage repair.'
        }
      ]
    },
    {
      category: 'Alternative Drivetrains & Vehicles',
      id: 'alternative-drivetrains',
      questions: [
        {
          id: 'ev-warranty',
          question: 'Do you offer an EV warranty for electric and hybrid vehicles?',
          answer: 'Yes, we offer specialised EV and hybrid car warranties. Electric vehicles have unique, highly advanced components that standard warranties often ignore. Our EV plans are specifically designed to cover high-voltage electrical systems, electric drive motors, power inverter modules, and onboard charging systems, protecting you from specialized repair costs.'
        },
        {
          id: 'hybrid-options',
          question: 'What are the warranty options for hybrid cars?',
          answer: 'Hybrid vehicles use a blend of traditional combustion and high-voltage electric technology, requiring specialized protection. We offer comprehensive hybrid warranty plans that cover standard mechanical parts (like the petrol or diesel engine) alongside dedicated hybrid components. This includes the electric drive motors, power inverter modules, electronic control units (ECUs), and regenerative braking systems.'
        },
        {
          id: 'van-motorbike-warranty',
          question: 'Can I purchase a van warranty or motorbike warranty through your site?',
          answer: 'Yes! We don\u2019t just cover cars. We provide comprehensive commercial van warranties to keep your business moving, as well as specialized motorbike and motorcycle warranties across the UK. Whether you use your van for daily deliveries or your bike for weekend touring, our plans cover major mechanical and electrical failures to minimize your downtime and keep repair bills at zero.'
        }
      ]
    },
    {
      category: 'Choosing a Plan & Terminology',
      id: 'choosing-plan-terminology',
      questions: [
        {
          id: 'compare-providers',
          question: 'How does Buyawarranty compare to other car warranty providers?',
          answer: 'Unlike standard policies that hide behind strict exclusions, Buyawarranty.co.uk offers clear, transparent cover with market-leading claims payout rates. When comparing car warranties, look closely at the covered parts list, claim limits, and garage flexibility. We offer tailored plans, allow you to choose your own VAT-registered repairer, and provide an easy, digital claims process to save you money without the hassle.'
        },
        {
          id: 'best-uk-provider',
          question: 'What makes Buyawarranty the best car warranty provider in the UK?',
          answer: 'We are consistently rated among the best car warranty providers in the UK because we eliminate the guesswork with clear terms and conditions. When you compare car warranties, many competitors lock you into restrictive networks or feature low claims limits. Buyawarranty.co.uk stands out by offering competitive pricing, high individual claim limits, ability to use any VAT-registered UK garage, and an entirely digital, hassle-free claims process.'
        },
        {
          id: 'warranty-vs-insurance',
          question: 'Is a car warranty the same as car warranty insurance?',
          answer: 'While often used interchangeably, "car warranty insurance" (or mechanical breakdown insurance) specifically protects you from the sudden, unexpected financial shock of mechanical and electrical component failures. Unlike standard car insurance, which only covers accidents, theft, or fire, our auto warranty policies look after the internal health of your vehicle, covering parts and labour costs when components wear out or break down during normal driving conditions.'
        },
        {
          id: 'comparison-checklist',
          question: 'Car Warranty Comparison: What should I look out for?',
          answer: 'When doing a car warranty comparison, the most important factors to look at are the individual claim limits, allowed garage hourly labour rates, and consequential damage rules (whether the failure of an uncovered part damaging a covered part is paid for). Many cheap policies feature low claim ceilings (e.g., £500 per claim), which won\'t cover a luxury engine or gearbox failure. At Buyawarranty.co.uk, we pride ourselves on high claim limits, transparent terms, and the freedom to choose your own trusted repairer.'
        },
        {
          id: 'why-extended-used',
          question: 'Why should I buy an extended warranty for a used car?',
          answer: 'Buying an aftermarket warranty for a used car removes the financial gamble of pre-owned vehicle ownership. While a used car may run perfectly during a test drive, component degradation from previous owners is impossible to predict. An extended warranty acts as a safety net, ensuring that if an expensive component like an alternator, steering rack, or gearbox fails six months down the line, you aren\'t stuck with a potentially expensive repair bill.'
        }
      ]
     },
    {
      category: 'Contact Information',
      id: 'contact-information',
      questions: [
        {
          id: 'how-contact-you',
          question: 'How can I contact you?',
          answer: 'Get in touch – we\'re here to help with any questions or support you need.\n\n✔️ Customer Sales and Support\n\n • Email: support@buyawarranty.co.uk\n • Phone: 0330 229 5040\n • Monday to Friday, 9am – 5:30pm\n\n✔️ Claims and Repairs\n • Email: claims@buyawarranty.co.uk\n • Phone: 0330 229 5045\n • Monday to Friday, 9am – 5:30pm\n\nFriendly support whenever you need us!'
        }
      ]
    }
  ];

  // Filter FAQs based on search term
  const filteredFAQs = useMemo(() => {
    if (!searchTerm) return faqData;
    
    return faqData.map(category => ({
      ...category,
      questions: category.questions.filter(
        q => 
          q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(category => category.questions.length > 0);
  }, [searchTerm]);

  // Get popular questions
  const popularQuestions = faqData
    .flatMap(category => category.questions)
    .filter(q => q.popular)
    .slice(0, 5);

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveCategory(categoryId);
    }
  };

  const generateAIAnswer = async (query: string) => {
    setIsLoadingAI(true);
    setShowAIAnswer(true);
    
    try {
      // Create a comprehensive knowledge base from all FAQ data
      const siteKnowledge = `
        Company: Buy-a-Warranty - Car, Van, and Motorcycle Extended Warranty Provider
        
        Core Services:
        - Extended warranties for cars, vans, and motorcycles
        - Coverage for petrol, diesel, hybrid, PHEV, and electric vehicles
        - One comprehensive Platinum Plan covering mechanical and electrical parts
        - Optional add-ons: Wear & tear, 24/7 recovery, tyre cover, Europe cover, vehicle rental, transfer cover
        
        Key Features:
        - Warranty costs from £12/month
        - Plans available for 1, 2, or 3 years
        - Vehicles up to 15 years old and 150,000 miles eligible
        - Cover begins immediately with no waiting period (pre-existing faults excluded)
        - Fast claim processing (within 90 minutes of approval)
        - Direct payment to garages or reimbursement
        - Claims team: 0330 229 5045 (Mon-Fri 09:00-17:30)
        - Support email: support@buyawarranty.co.uk
        
        Coverage Details:
        - All mechanical and electrical parts
        - Engine, gearbox, drivetrain, turbocharger, fuel systems
        - Cooling, exhaust, brakes, suspension, steering
        - Air conditioning, electrical systems, ECUs, sensors
        - For EVs: drive motors, high-voltage battery, inverters, chargers
        - For hybrids: hybrid motors, batteries, power control units
        - Labour costs and diagnostics included
        
        What's Not Covered:
        - Pre-existing faults
        - Routine maintenance (unless add-on purchased)
        - Accident/collision damage
        - Commercial use (taxi, courier, rental)
        
        Claims Process:
        1. Contact claims team at 0330 229 5045
        2. Get vehicle diagnosed at garage
        3. Garage must contact claims team before repairs
        4. Fast approval and payment process
        
        Additional Services:
        - Can use own garage (must be VAT registered)
        - 14-day cancellation period for full refund
        - Transferable warranty (£30 fee)
        - European coverage available
        - 24/7 breakdown recovery
        - Vehicle rental during repairs
        
        ${faqData.map(category => 
          `${category.category}:\n${category.questions.map(q => 
            `Q: ${q.question}\nA: ${q.answer}`
          ).join('\n\n')}`
        ).join('\n\n')}
      `;

      // Simple AI-like response generation based on keyword matching
      const lowerQuery = query.toLowerCase();
      let response = '';

      if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('how much')) {
        response = 'Our warranty costs start from just £12 per month, depending on your vehicle and coverage level. We offer flexible payment options including paying in full (with savings), 12-month interest-free payments, or monthly Pay As You Go. You can get an instant quote by entering your registration number on our homepage.';
      } else if (lowerQuery.includes('claim') || lowerQuery.includes('repair')) {
        response = 'To make a claim, contact our Claims Team at 0330 229 5045 (Mon-Fri 09:00-17:30) or use our online form. Get your vehicle diagnosed at a garage first, then the garage must contact our claims team before starting repairs. We process claims within 90 minutes of approval and can pay the garage directly.';
      } else if (lowerQuery.includes('cover') || lowerQuery.includes('what') || lowerQuery.includes('include')) {
        response = 'Our Platinum Plan covers all mechanical and electrical parts including engine, gearbox, drivetrain, electrical systems, ECUs, sensors, and labour costs. We cover cars, vans, and motorcycles (petrol, diesel, hybrid, and electric). Optional add-ons available for wear & tear, tyres, Europe cover, and more.';
      } else if (lowerQuery.includes('electric') || lowerQuery.includes('ev') || lowerQuery.includes('hybrid')) {
        response = 'Yes, we cover electric and hybrid vehicles! For EVs we cover drive motors, high-voltage battery, inverters, chargers, and thermal systems. For hybrids we cover all the above plus petrol/diesel engine components, hybrid drive motors, batteries, and power control units.';
      } else if (lowerQuery.includes('garage') || lowerQuery.includes('mechanic')) {
        response = 'You can use your preferred garage for repairs as long as they\'re VAT registered. You can choose a main dealer, but may need to cover the price difference compared to an independent garage. We can also recommend trusted repair centres in our network.';
      } else if (lowerQuery.includes('cancel') || lowerQuery.includes('refund')) {
        response = 'You have 14 days to cancel your warranty for a full refund (if no repairs have been made). After this period, our standard cancellation policy applies. Contact us at support@buyawarranty.co.uk or call 0330 229 5045 for cancellation requests.';
      } else if (lowerQuery.includes('transfer') || lowerQuery.includes('sell') || lowerQuery.includes('new owner')) {
        response = 'Yes, the warranty is transferable to a new owner when you sell your vehicle privately. This adds value to your car and is a great selling point. There is a £30 fee for transferring the warranty. Contact us to arrange the transfer.';
      } else if (lowerQuery.includes('age') || lowerQuery.includes('old') || lowerQuery.includes('mileage') || lowerQuery.includes('eligible')) {
        response = 'We cover vehicles up to 15 years old and up to 150,000 miles. We offer warranty plans for 1, 2, or 3 years. Whether your vehicle is petrol, diesel, hybrid, or electric, we likely have coverage available.';
      } else if (lowerQuery.includes('breakdown') || lowerQuery.includes('recovery') || lowerQuery.includes('roadside')) {
        response = 'We offer 24/7 Vehicle Recovery as an add-on for £4/month. This covers recovery costs when you\'ve already been recovered. We also offer European coverage and vehicle rental during repairs as additional options.';
      } else if (lowerQuery.includes('service') || lowerQuery.includes('maintenance') || lowerQuery.includes('mot')) {
        response = 'Yes, you need to keep up with regular servicing to maintain your warranty validity. Follow the manufacturer\'s service schedule and keep your receipts. Routine maintenance isn\'t covered unless you add our Wear & Tear cover add-on.';
      } else {
        response = `I couldn't find a specific FAQ for "${query}", but I can help! Our comprehensive warranty covers mechanical and electrical parts for cars, vans, and motorcycles. For specific questions, please contact our team at 0330 229 5045 or support@buyawarranty.co.uk. You can also browse our detailed FAQ categories above for more information.`;
      }

      setAiAnswer(response);
    } catch (error) {
      console.error('Error generating AI answer:', error);
      setAiAnswer(`I couldn't find a specific answer for "${query}" in our FAQ. For personalized assistance, please contact our support team at 0330 229 5045 or support@buyawarranty.co.uk. You can also browse our FAQ categories above for related information.`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // FAQ schema (JSON-LD) — curated list for SEO
  const faqSchemaData = useMemo(() => [
    { question: "What's a car warranty and why should I get one?", answer: "Think of a warranty as a backup plan for your car. If something goes wrong – like a mechanical or electrical fault – your warranty helps cover the cost of repairs. New cars usually come with a manufacturer's warranty for about 3 years. After that, you're on your own unless you get an extended warranty. That's where we come in – giving you peace of mind and helping you avoid surprise bills." },
    { question: "Why bother with an extended warranty?", answer: "Once your manufacturer's warranty runs out, you're responsible for any repairs. Our extended warranty helps protect you from unexpected costs – whether it's a breakdown, electrical fault or something else. We also include extras like roadside recovery, car hire and onward travel. It's all about making life easier and less stressful when things go wrong." },
    { question: "How do I choose the right plan for my car?", answer: "We'll help you pick a plan that suits your car's age, mileage and how you use it. Whether you drive a little or a lot, we've got options to match. Feel free to WhatsApp us using the icon or call us on 0330 229 5040 we'll be happy to help." },
    { question: "Do You Cover Older or High Mileage Vehicles?", answer: "Absolutely. Unlike many other warranty providers, we're here to help you protect more vehicles, for longer: Cover for vehicles up to 15 years old, cover for vehicles with up to 150,000 miles, and flexible plans for 12, 24, or 36 months." },
    { question: "Can I buy a warranty for a used car, and when should I get it?", answer: "Yes, absolutely! We specialise in providing comprehensive extended warranties specifically for used cars. It is highly recommended that you buy a warranty as soon as your manufacturer's warranty expires, or immediately after purchasing a used vehicle privately or from a dealership. This ensures you avoid unexpected, costly mechanical or electrical repair bills from day one." },
    { question: "What should I do if my car has an issue?", answer: "If your car experiences a problem, please contact our Claims Team at 0330 229 5045. They are available Monday to Friday from 09:00 to 17:30 and can help start and process your warranty claim. If the issue arises outside of these hours, please fill out our online contact form at www.buyawarranty.co.uk/make-a-claim." },
    { question: "How do I make a claim?", answer: "Arrange for your vehicle to be inspected by a local independent repair garage to diagnose any issues. Once diagnosed, before any repairs are conducted, the repairer must directly contact our Claims Team at 0330 229 5045. It's important to note that failure to do so will not allow us to process your claim." },
    { question: "Is it easy to make a claim and get my repair done?", answer: "Yes, absolutely – we've made it simple and hassle-free. You follow a few quick steps to start your claim, we guide you through the process from start to finish, and repairs are handled quickly and professionally. You can choose your own garage or use our trusted network, and payouts are usually processed within 90 minutes of approval." },
    { question: "Do we actually pay out claims?", answer: "It's a fair question - and the answer is yes. We genuinely value our customers, and when something goes wrong, we don't look for loopholes. We look for reasons to say yes. With easy-to-follow terms, we're committed to giving you reliable protection and peace of mind." },
    { question: "Do I have to pay the garage upfront and then seek reimbursement from you?", answer: "No, in most cases we can pay the garage directly for authorised repairs via bank transfer, so you're not out of pocket. However, if your chosen garage isn't able or willing to deal directly with a warranty company, you can pay for the repair yourself and send us the invoice. Once we've approved your claim and received a valid invoice, we'll reimburse you promptly—no delays or complications." },
    { question: "How much do I need to pay?", answer: "When your claim is authorised, it will be for a specific amount agreed with your chosen repair garage. If you're within your claim limit, and the parts and labour are covered by your plan, you won't have to pay anything. You may need to pay any warranty excess, the cost of parts not covered by your plan, or any amount above your claim limit." },
    { question: "Is a vehicle inspection necessary before I can make a claim?", answer: "In certain situations, we may need to inspect your vehicle before validating your claim." },
    { question: "When can I make my first claim?", answer: "You can make your first claim 30 days after you buy your plan, unless you already had an active warranty with us. If you're renewing or moving from one of our plans to another with continuous cover, you can claim straight away. For example: If you buy your plan today and a warning light appears after one week, you'll be able to make a claim once 30 days have passed." },
    { question: "What if I don't have a full service history?", answer: "No problem. If you don't have a complete service history, you can get a full service done now and then contact us about your claim. This way, you're still eligible for cover and can claim with confidence." },
    { question: "Is there a 30‑day wait for new customers?", answer: "No - your cover begins immediately. As long as there are no pre‑existing faults on the vehicle, you're protected from the moment your warranty starts. The only things we can't cover are issues that were already present before the plan began." },
    { question: "What's covered in my warranty?", answer: "At Buy-a-Warranty, we like to keep things simple. One solid plan that works for cars, vans, and motorbikes, whether you're driving electric, hybrid, petrol, or diesel. We keep things simple with no confusing packages, you won't encounter any unexpected rejections, and we offer straightforward cover without the hassle." },
    { question: "What's included in my warranty?", answer: "Our Platinum Plan comes as standard and includes: all mechanical and electrical parts covered, labour costs included, fault diagnostics, consequential damage cover, and access to trusted repair centres or your own garage." },
    { question: "What components are covered?", answer: "Our warranty covers a wide range of parts and systems, including: engine, gearbox, drivetrain, turbocharger, fuel systems, cooling, exhaust, brakes, suspension, steering, air conditioning, electrical systems, ECUs, sensors, lighting, multimedia, driver assistance, safety systems, hybrid/PHEV components, electric vehicle systems, and motorcycles. For full details, please see our 'What's covered' section." },
    { question: "What parts are covered for my petrol or diesel car or van?", answer: "Our warranty covers a wide range of important parts and systems. Included components are: Engine & internal components (pistons, valves, camshafts, timing chains, seals, gaskets), Gearbox / transmission systems (manual, automatic, DSG, CVT, dual-clutch, transfer boxes), Drivetrain & clutch assemblies (flywheel, driveshafts, differentials), Turbocharger & supercharger units, Fuel delivery systems (tanks, pumps, injectors, fuel rails, fuel control electronics), Cooling & heating systems (radiators, thermostats, water pumps, cooling fans, heater matrix), and Exhaust & emissions systems (catalytic converters, DPFs, OPFs, EGR valves, NOx)." },
    { question: "What parts are covered for Hybrid & PHEV Vehicle?", answer: "Our warranty covers a wide range of hybrid and plug-in hybrid components, including: all petrol/diesel engine parts and labour, hybrid drive motors & ECUs, hybrid battery failure, power control units, inverters & DC-DC converters, regenerative braking systems, high-voltage cables & connectors, cooling systems for hybrid components, charging ports & on-board charging modules, hybrid transmission components, braking systems, suspension & steering systems, air conditioning, electrical components, ECUs & sensors, lighting & ignition systems, factory-fitted multimedia & infotainment systems, driver assistance systems, and safety systems." },
    { question: "What's covered for Electric Vehicles (EVs)?", answer: "Our warranty covers a wide range of essential EV components, including: EV drive motors & reduction gear, EV transmission & reduction gearbox assemblies, high-voltage battery failure, power control units & inverters, on-board charger (OBC) & charging ports, DC-DC converters, thermal management systems, high-voltage cables & connectors, and EV-specific control electronics." },
    { question: "What parts are covered for my motorbike?", answer: "Our warranty covers a wide range of key motorcycle components, including: Engine / motor & drivetrain components, Gearbox / transmission systems, ECUs, sensors & control modules, Electrical systems & wiring, High-voltage battery failure (hybrid & EV), Suspension & steering systems, Braking systems, Cooling & thermal systems, Lighting & ignition systems, and Instrumentation & rider controls." },
    { question: "What optional extras do you offer?", answer: "We offer vehicle rental options, wear & tear cover, tyre replacement cover, European repair cover, breakdown recovery, and transferable warranty protection options. For full details on what's included, visit our 'What's covered' page." },
    { question: "What's not covered?", answer: "We do not cover pre-existing faults, routine servicing or maintenance (e.g. fluids, tyres, brake pads), vehicles used for hire or reward (e.g. taxi, rental, courier), accident or collision damage, and indirect or knock-on financial losses (e.g. hotel bookings, lost earnings)." },
    { question: "What does your warranty cover?", answer: "Our plans cover a wide range of parts – from the engine and gearbox to electrical systems and more. We offer the most comprehensive warranty plan for our customers to ensure that you get the most cover." },
    { question: "Are there items that aren't covered?", answer: "Yes, some items like wear-and-tear items (e.g. tyres, brake pads) unless you take the add-on option for wear and tear, tyre cover etc or damage from accidents are not included. We'll always be upfront about what's covered and what's not, so there are no surprises." },
    { question: "Does my warranty cover wear and tear?", answer: "Warranty plans are designed to cover unexpected faults and failures, rather than items that naturally wear out over time. Even manufacturer warranties on brand-new cars don't include normal wear and tear. However, for extra peace of mind, we offer wear & tear cover as an optional add-on. You can select this additional protection when purchasing your warranty—just look for the option on the pricing page." },
    { question: "Does my warranty cover diagnostic charges?", answer: "The warranty does cover diagnostic charges. We also cover physical dismantling charges in the event of a valid claim, subject to the warranty's maximum claim limit." },
    { question: "What counts as mechanical or electrical parts?", answer: "Mechanical parts are things like your engine, gearbox and suspension. Electrical parts include your car's wiring, sensors, and tech systems. We'll explain exactly what's covered in your plan." },
    { question: "What claim limit is right for me?", answer: "It depends on your vehicle and how much protection you want. £1,000 is ideal for smaller or lower‑cost repairs. £2,000 offers broader cover for most mid‑range repairs. £3,000 is our most popular option and covers the majority of common faults in full. £5,000 provides our highest level of protection and is best suited to newer, higher‑value or more complex vehicles where repair costs can be significantly higher." },
    { question: "What are the repair limits?", answer: "We'll cover repairs up to the claim limit you chose when you signed up." },
    { question: "Can I increase my claim limit for a claim?", answer: "If you decide you want a higher claim limit, you can call 0330 229 5040 or email support@buyawarranty.co.uk to upgrade. The higher limit will apply to any future approved claims after the upgrade is confirmed." },
    { question: "Are repairs unlimited on unlimited plans?", answer: "Repairs are covered up to the original purchase price of your vehicle, giving you ongoing protection for as long as your plan is active." },
    { question: "What if something falls outside these terms, do you reject claims?", answer: "We get that life isn't always black and white. If something falls outside these terms, we'll still look at it fairly and help where we can." },
    { question: "Can I get cover for a high performance or high end vehicle?", answer: "Some vehicles like Range Rover, BMW M/7 Series, Audi RS, Mercedes-AMG, Porsche, Jaguar, and Maserati may not be eligible due to specialist parts and higher repair costs. Please check our vehicle eligibility guide at: https://buyawarranty.co.uk/what-is-covered" },
    { question: "What if I buy a warranty and my high performance or high end vehicle isn't eligible?", answer: "If your vehicle falls into a restricted category, we'll cancel your policy and issue a full refund in line with our terms." },
    { question: "How do I check if my vehicle qualifies before buying?", answer: "If you're unsure, please check our vehicle eligibility guide at: https://buyawarranty.co.uk/what-is-covered" },
    { question: "Is my car too old or too many miles?", answer: "We cover many older and higher mileage vehicles up to 15 years old and 150,000 miles. Check your instant price to confirm." },
    { question: "What about modified vehicles?", answer: "Most body modifications are accepted. Call us on 0330 229 5040 or request a call back using the Call us button in the top navigation bar." },
    { question: "What is the most expensive repair you have covered?", answer: "We regularly cover repairs over £1,500 for engines, gearboxes and ECUs. Higher claim limits are available. Check your instant price by entering your registration." },
    { question: "Do I need a full service history?", answer: "A reasonable service history is fine. Many vehicles are accepted even if servicing has been missed." },
    { question: "Are diagnostics covered?", answer: "Diagnostics are usually covered when the fault is approved." },
    { question: "Is your car warranty cover valid across the entire UK?", answer: "Yes, all of our car warranty plans offer complete coverage across England, Scotland, Wales, and Northern Ireland. If your vehicle breaks down anywhere in the UK, you can take it to any VAT-registered garage nationwide, or utilise our network of approved repair specialists to get you back on the road quickly." },
    { question: "What does a \"limited warranty\" actually cover?", answer: "A limited warranty means that coverage is restricted to specific parts, timeframes, or conditions listed in the policy, rather than covering \"everything.\" For example, a manufacturer's limited warranty typically protects against factory defects in materials or workmanship but explicitly excludes everyday wear-and-tear items (like brake pads, tyres, and wiper blades), routine servicing, and damage from accidents or neglect. Our policies clearly define these limits upfront so you always know exactly what is protected." },
    { question: "Can I use my preferred garage for repairs?", answer: "You can use your own garage, including main dealers or local independents, as long as they're VAT registered. If the repair cost goes over your claim limit, you may need to pay the difference (top up the extra amount)." },
    { question: "Can I use my own garage?", answer: "Absolutely – as long as they're VAT-registered and follow our repair guidelines. We want you to feel comfortable with who's working on your car." },
    { question: "What if I break down outside office hours or on holiday?", answer: "Our office hours are 9am to 5:30pm, Monday to Friday. If you break down outside these hours, you can still take your vehicle to a garage and ask them to contact us on Monday morning. If it's the weekend, you can also complete the claim form online. Please note, we're only able to make payments and authorise repairs between 9am and 5:30pm, Monday to Friday—so please don't start any work without our go-ahead." },
    { question: "Will you cover the cost of a hire car?", answer: "If your car's off the road due to a covered fault, we can help with car hire costs. It's one of the handy extras included in many of our plans." },
    { question: "Can I get help if I break down abroad?", answer: "Yes – we offer European cover claim back with some of our plans. Just let us know where you're going and we'll make sure you're protected." },
    { question: "Do I need to get my vehicle serviced?", answer: "Yes, you do. It is important to adhere to the manufacturer's recommendations for servicing at the correct times/mileages after taking delivery of the vehicle. The service does not necessarily have to be completed by a main dealer unless you want to maintain a full dealer history, but it is important to retain relevant receipts as proof." },
    { question: "Do I need to service my car regularly?", answer: "Yes please! Keeping up with your car's servicing schedule helps keep your warranty valid. Just follow the manufacturer's guidelines and keep your receipts." },
    { question: "Do I need to service my car before getting a warranty?", answer: "If your car's service history is up to date, you're good to go. If it's missing a service, you'll need to get that done before your cover starts. Just follow the manufacturer's servicing schedule and keep your receipts." },
    { question: "What if the previous owner missed a service?", answer: "No worries – you'll just need to get the vehicle serviced properly before your warranty kicks in. It's all about making sure your vehicle's in good shape from the start." },
    { question: "Do I need an inspection before buying a plan?", answer: "No – we don't require a vehicle inspection. Just make sure your car meets the basic eligibility criteria." },
    { question: "What mileage limit applies?", answer: "Your vehicle should not exceed 2,000 miles per month." },
    { question: "What are the servicing requirements?", answer: "A full service history is needed, if you don't have that simply get a full service within 30 days of starting your plan. Once the service is done and the 30 days have passed, you can make your first claim if needed." },
    { question: "How long can I get cover for?", answer: "You can choose a plan that suits you – pay in full and save more money, spread it over 12 months interest free, or go for monthly Pay As You Go. We're flexible." },
    { question: "What if I change my mind after buying?", answer: "No problem. You've got a cooling-off period (usually 14 days) to cancel for a full refund, as long as you haven't made a claim." },
    { question: "What are my cancellation rights?", answer: "You can cancel within 14 days of purchase for a full refund, as long as no repairs have been made. After 14 days, our standard cancellation policy applies. However, if you've set up a payment plan with one of our lenders, unfortunately refunds after 14 days aren't possible, as you'll be in a contract for your warranty plan." },
    { question: "How do I cancel my warranty?", answer: "You have 14 days to cancel your warranty. If you wish to cancel your warranty, please reach out to us at support@buyawarranty.co.uk or call us on 0330 229 5045." },
    { question: "Is the warranty transferable?", answer: "Yes, our warranties can be transferred to a new owner if you sell your car privately—this can help you sell your vehicle and may even increase its value. There's a £19.99 fee if you choose to transfer the warranty at the time of purchase. If you decide to transfer it later, the fee is £30. To transfer your warranty, just get in touch with us using the contact form." },
    { question: "Can I transfer my warranty to another vehicle?", answer: "Your warranty plan may be transferred with a small fee if a replacement vehicle is of a vehicle type that we provide warranty for i.e most vehicles. Please email support@buyawarranty.co.uk to transfer your warranty or choose the option from the pricing page when you purchase your warranty." },
    { question: "Can I cancel my warranty?", answer: "You have 14 days to cancel your warranty for a full refund for FREE (if no repairs have been made). After this period, our standard easy to follow cancellation policy applies. Simply visit https://buyawarranty.co.uk/cancel-warranty/" },
    { question: "Where can I find the cheapest car warranty that still offers good coverage?", answer: "While it's tempting to look purely for the \"cheapest\" car warranty, the lowest price often means high hidden excesses or essential parts being excluded. At Buyawarranty.co.uk, we focus on providing the best value in the UK — combining highly competitive, affordable pricing with comprehensive cover that actually pays out when you need it. We offer flexible payment plans to break down the cost into manageable monthly payments." },
    { question: "What types of vehicles are covered under your standard vehicle warranty?", answer: "Our standard vehicle warranty options cover a vast range of makes and models across the UK. Whether you are looking to buy a car warranty for a family hatchback, a premium SUV (like a Range Rover), a performance saloon, or even alternative vehicles like motorbikes and vans, we have a plan for you. We cover everything from major engine and gearbox components to intricate electrical systems, depending on the tier of cover you select for your vehicle." },
    { question: "Do you offer specialist cover like an Audi extended warranty?", answer: "Yes. We offer premium vehicle warranties tailored for high-end and German vehicles, including comprehensive Audi extended warranty coverage. Because parts and diagnostic labour rates for luxury brands like Audi can be incredibly expensive, our policies are designed to cover advanced electrical components, DSG/S-tronic gearboxes, and engine management systems to give you total peace of mind." },
    { question: "How much does a Mercedes extended warranty cost?", answer: "The cost of a Mercedes extended warranty depends entirely on your vehicle's age, mileage, and the level of cover you choose. Because Mercedes-Benz vehicles feature complex technology like AIRMATIC suspension, MBUX infotainment systems, and precision engineering, main dealer repairs can be incredibly expensive. At Buyawarranty.co.uk, we provide tailored, dealer-level cover for Mercedes models at a fraction of the cost of a manufacturer policy. Get a quick quote online today to see your exact price." },
    { question: "Can I get an extended warranty for a used Mercedes-Benz?", answer: "Yes, we provide comprehensive extended warranty protection specifically tailored for used Mercedes-Benz vehicles. Buying a pre-owned Mercedes is exciting, but out-of-warranty repair costs for premium AMG lines, complex 4MATIC systems, or electrical command modules can be exceptionally high. Our used Mercedes policies are designed to pick up where the original manufacturer warranty left off, protecting your wallet from sudden mechanical or electrical failures at a fraction of the cost of main dealer prices." },
    { question: "Do you offer a VW extended warranty for Volkswagen vehicles?", answer: "Yes, we offer comprehensive component protection for all major Volkswagen models, including the Golf, Polo, Tiguan, and Passat. Our VW extended warranty covers major mechanical and electrical failures—including common DSG gearbox issues, turbocharger faults, and advanced driver assistance systems (ADAS)—ensuring your vehicle remains reliable without breaking the bank." },
    { question: "What does a VW extended warranty cover?", answer: "Our Volkswagen extended warranty is designed to mimic factory-level protection for peace of mind. It covers sudden mechanical and electrical failures across major VW assemblies. This includes the engine, fuel injection systems, cooling system, and steering. Crucially for VW owners, our premium plans provide vital coverage for complex Volkswagen technologies, such as DSG/automatic gearboxes, turbochargers, and on-board infotainment systems, using any VAT-registered garage across the UK." },
    { question: "What are the Land Rover and Range Rover extended warranty prices in the UK?", answer: "Land Rover and Range Rover extended warranty prices vary depending on your vehicle's age, mileage, and specific model (such as a Sport, Evoque, or Defender). Because luxury SUVs feature highly advanced 4x4 drivetrains, air suspension setups, and premium electronics, main dealer repair costs are notoriously steep. At Buyawarranty.co.uk, we provide equivalent main-dealer level protection for Land Rovers at a significantly lower rate. Get an instant quote online to view our current tiered pricing packages." },
    { question: "How much does a Hyundai extended warranty cost?", answer: "Hyundai vehicles are known for their reliability, but as they age past their original 5-year manufacturer warranty, components like complex infotainment screens, fuel injection systems, and automatic transmissions can still fail. The cost of a Hyundai extended warranty with us is highly affordable and tailored to your vehicle's specific mileage. It is designed to offer maximum protection for a fraction of the cost of a single major garage repair." },
    { question: "Do you offer an EV warranty for electric and hybrid vehicles?", answer: "Yes, we offer specialised EV and hybrid car warranties. Electric vehicles have unique, highly advanced components that standard warranties often ignore. Our EV plans are specifically designed to cover high-voltage electrical systems, electric drive motors, power inverter modules, and onboard charging systems, protecting you from specialized repair costs." },
    { question: "What are the warranty options for hybrid cars?", answer: "Hybrid vehicles use a blend of traditional combustion and high-voltage electric technology, requiring specialized protection. We offer comprehensive hybrid warranty plans that cover standard mechanical parts (like the petrol or diesel engine) alongside dedicated hybrid components. This includes the electric drive motors, power inverter modules, electronic control units (ECUs), and regenerative braking systems." },
    { question: "Can I purchase a van warranty or motorbike warranty through your site?", answer: "Yes! We don't just cover cars. We provide comprehensive commercial van warranties to keep your business moving, as well as specialized motorbike and motorcycle warranties across the UK. Whether you use your van for daily deliveries or your bike for weekend touring, our plans cover major mechanical and electrical failures to minimize your downtime and keep repair bills at zero." },
    { question: "How does Buyawarranty compare to other car warranty providers?", answer: "Unlike standard policies that hide behind strict exclusions, Buyawarranty.co.uk offers clear, transparent cover with market-leading claims payout rates. When comparing car warranties, look closely at the covered parts list, claim limits, and garage flexibility. We offer tailored plans, allow you to choose your own VAT-registered repairer, and provide an easy, digital claims process to save you money without the hassle." },
    { question: "What makes Buyawarranty the best car warranty provider in the UK?", answer: "We are consistently rated among the best car warranty providers in the UK because we eliminate the guesswork with clear terms and conditions. When you compare car warranties, many competitors lock you into restrictive networks or feature low claims limits. Buyawarranty.co.uk stands out by offering competitive pricing, high individual claim limits, ability to use any VAT-registered UK garage, and an entirely digital, hassle-free claims process." },
    { question: "Is a car warranty the same as car warranty insurance?", answer: "While often used interchangeably, \"car warranty insurance\" (or mechanical breakdown insurance) specifically protects you from the sudden, unexpected financial shock of mechanical and electrical component failures. Unlike standard car insurance, which only covers accidents, theft, or fire, our auto warranty policies look after the internal health of your vehicle, covering parts and labour costs when components wear out or break down during normal driving conditions." },
    { question: "Car Warranty Comparison: What should I look out for?", answer: "When doing a car warranty comparison, the most important factors to look at are the individual claim limits, allowed garage hourly labour rates, and consequential damage rules (whether the failure of an uncovered part damaging a covered part is paid for). Many cheap policies feature low claim ceilings (e.g., £500 per claim), which won't cover a luxury engine or gearbox failure. At Buyawarranty.co.uk, we pride ourselves on high claim limits, transparent terms, and the freedom to choose your own trusted repairer." },
    { question: "Why should I buy an extended warranty for a used car?", answer: "Buying an aftermarket warranty for a used car removes the financial gamble of pre-owned vehicle ownership. While a used car may run perfectly during a test drive, component degradation from previous owners is impossible to predict. An extended warranty acts as a safety net, ensuring that if an expensive component like an alternator, steering rack, or gearbox fails six months down the line, you aren't stuck with a potentially expensive repair bill." },
  ], []);

  return (
    <>
      <SEOHead 
        title="Vehicle Warranty Services FAQ UK | BuyA Warranty Help"
        description="Find answers to all your questions about vehicle warranty services at BuyA Warranty. Comprehensive FAQ on coverage, claims, and UK car warranty options with expert advice."
        keywords="car warranty FAQ, warranty questions, car insurance claims, vehicle warranty coverage, warranty help"
        canonical="https://buyawarranty.co.uk/faq/"
      />
      <FAQSchema faqs={faqSchemaData} />
      
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <section className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-brand-dark-text mb-4">
                Frequently Asked <span className="text-primary">Questions</span>
              </h1>
              <p className="text-lg text-brand-dark-text max-w-3xl mx-auto mb-8">
                Find answers to the most common questions about our warranty services. 
                Can't find what you're looking for? We're here to help.
              </p>
              
              {/* Search Bar with Panda Image */}
              <div className="max-w-4xl mx-auto relative">
                <div className="flex items-center gap-6">
                  {/* Search Bar Container */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                    <Input
                      type="text"
                      placeholder="Search frequently asked questions..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                      }}
                      className="pl-12 pr-4 py-3 text-lg border-2 border-gray-800 focus:border-black rounded-lg"
                      role="combobox"
                      aria-expanded={showSuggestions}
                      aria-haspopup="listbox"
                      autoComplete="off"
                    />
                    
                    {/* Enhanced Auto-suggestions Dropdown */}
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 z-50 max-h-80 overflow-y-auto">
                        <div className="p-2">
                          <div className="text-xs font-medium text-gray-500 px-3 py-2 uppercase tracking-wide">
                            {searchTerm.length > 0 ? `${getSearchSuggestions(searchTerm).length} Suggestions` : 'Popular Searches'}
                          </div>
                          {getSearchSuggestions(searchTerm).map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-md text-sm text-gray-700 hover:text-primary transition-colors group focus:outline-none focus:bg-gray-50 focus:text-primary"
                              role="option"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSuggestionClick(suggestion);
                                }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <Search className="w-4 h-4 text-gray-400 group-hover:text-primary mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {typeof suggestion === 'string' ? suggestion : suggestion.question}
                                  </div>
                                  {typeof suggestion !== 'string' && (
                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                      <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                                        {suggestion.category}
                                      </span>
                                      {suggestion.popular && (
                                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                                          Popular
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                          {getSearchSuggestions(searchTerm).length === 0 && searchTerm.length > 0 && (
                            <div className="px-3 py-4 text-center text-gray-500 text-sm">
                              No suggestions found for "{searchTerm}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Panda with Coins Image */}
                  <div className="flex-shrink-0 hidden md:block">
                    <img 
                      src={pandaSavingsFaq} 
                      alt="Panda mascot saving money with warranty protection" 
                      className="w-32 h-32 object-contain"
                    />
                  </div>
                </div>
              </div>
              
              {/* Quick Category Chips */}
              <div className="max-w-4xl mx-auto mt-6 flex flex-wrap justify-center gap-3">
                {faqData.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => scrollToCategory(category.id)}
                    className="px-[18px] py-[10px] bg-white border border-black rounded-[20px] text-[15px] text-[#6f6f6f] cursor-pointer transition-all duration-150 hover:bg-[#f5f5f5] hover:text-black"
                  >
                    {category.category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                  <h3 className="font-bold text-lg text-brand-dark-text mb-4">Quick Navigation</h3>
                  <nav className="space-y-2">
                    {faqData.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => scrollToCategory(category.id)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          activeCategory === category.id
                            ? 'bg-primary text-white'
                            : 'text-brand-dark-text hover:bg-gray-100'
                        }`}
                      >
                        {category.category}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Popular Questions */}
                {!searchTerm && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="font-bold text-lg text-brand-dark-text mb-4">Popular Questions</h3>
                    <div className="space-y-3">
                      {popularQuestions.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => toggleItem(q.id)}
                          className="w-full text-left text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                          {q.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Savings Section - Hidden on Mobile */}
                {!searchTerm && (
                  <div className="hidden md:block bg-gradient-to-br from-orange-50/50 to-white rounded-lg border border-orange-100 p-5 mt-6">
                    <h3 className="font-semibold text-base text-brand-dark-text mb-3">Save Money with an Extended Car Warranty from Buyawarranty.co.uk</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                      Protect your vehicle and your wallet with our trusted UK car warranty plans. Here's why thousands of drivers choose Buyawarranty:
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm text-brand-dark-text mb-1">Save Money on Repairs</h4>
                        <p className="text-muted-foreground text-sm">
                          Avoid unexpected garage bills. With Buyawarranty, our extended car warranty can save you thousands compared to paying for major repairs out of pocket.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-brand-dark-text mb-1">Affordable Monthly Payments</h4>
                        <p className="text-muted-foreground text-sm">
                          Spread the cost with small, manageable payments from Buy-A-Warranty that give you peace of mind.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-brand-dark-text mb-1">Comprehensive UK Coverage</h4>
                        <p className="text-muted-foreground text-sm">
                          From engine to electrics, Buyawarranty.co.uk offers plans that cover the essentials that matter most.
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-brand-dark-text mb-1">Instant Activation</h4>
                        <p className="text-muted-foreground text-sm">
                          Your protection starts immediately after purchase (excludes pre-existing conditions).
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-brand-dark-text mb-1">Trusted by UK Drivers</h4>
                        <p className="text-muted-foreground text-sm">
                          Join thousands who rely on Buyawarranty.co.uk for reliable, affordable cover.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              {searchTerm && (
                <div className="mb-6">
                  <p className="text-brand-dark-text">
                    {filteredFAQs.reduce((total, category) => total + category.questions.length, 0)} 
                    {' '}results found for "{searchTerm}"
                  </p>
                </div>
              )}

              {filteredFAQs.map((category) => (
                <section key={category.id} id={category.id} className="mb-12" itemScope itemType="https://schema.org/FAQPage">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-primary">
                    <h2 className="text-2xl font-bold text-brand-dark-text">
                      {category.category}
                    </h2>
                    {category.category === 'Getting Started' && (
                      <TrustpilotMicroStarWidget className="max-w-[200px]" />
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {category.questions.map((faq) => (
                      <article key={faq.id} id={faq.id} className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden" itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                        <button
                          onClick={() => toggleItem(faq.id)}
                          className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-orange-600/20 transition-colors"
                        >
                          <div className="flex items-center">
                            <h3 className="font-semibold text-lg text-white pr-4" itemProp="name">
                              {faq.question}
                            </h3>
                            {faq.popular && (
                              <span className="bg-white text-orange-600 text-xs px-2 py-1 rounded-full font-medium">
                                Popular
                              </span>
                            )}
                          </div>
                          <ChevronDown 
                            className={`w-6 h-6 flex-shrink-0 text-white transition-transform duration-300 ${
                              openItems[faq.id] ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        
                        <div className={`overflow-hidden transition-all duration-200 ease-out ${
                          openItems[faq.id] 
                            ? 'max-h-screen opacity-100 animate-accordion-down' 
                            : 'max-h-0 opacity-0'
                        }`}>
                          <div className="px-6 pb-5 bg-white border-t border-orange-200" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                            <div className="pt-4 transform translate-y-0">
                              <div className="text-brand-dark-text leading-relaxed whitespace-pre-line" itemProp="text">
                                {renderAnswerWithLinks(faq.answer)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}

              {!searchTerm && (
                <p className="text-sm text-brand-dark-text/70 italic mt-6 text-center">
                  Please refer to our <Link to="/terms" className="text-brand-orange hover:underline">terms and conditions</Link> for full details.
                </p>
              )}


              {/* AI-Generated Answer Section */}
              {showAIAnswer && (
                <section className="mt-8">
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <Search className="w-5 h-5" />
                        AI Assistant Response
                      </CardTitle>
                      <CardDescription className="text-blue-600">
                        I couldn't find an exact match in our FAQ, but here's what I found based on our warranty information:
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAI ? (
                        <div className="flex items-center gap-2 text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Searching our knowledge base...</span>
                        </div>
                      ) : (
                        <div className="prose prose-blue max-w-none">
                          <p className="text-blue-800 leading-relaxed">{aiAnswer}</p>
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-sm text-blue-600">
                          For more specific information, please contact our team at{' '}
                          <a href="tel:03302295045" className="font-medium hover:underline">
                            0330 229 5045
                          </a>{' '}
                          or{' '}
                          <a href="mailto:support@buyawarranty.co.uk" className="font-medium hover:underline">
                            support@buyawarranty.co.uk
                          </a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Related Questions Section */}
              {searchTerm && filteredFAQs.length === 0 && relatedQuestions.length > 0 && (
                <section className="mt-8">
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-800">
                        <MessageCircle className="w-5 h-5" />
                        Related Questions
                      </CardTitle>
                      <CardDescription className="text-yellow-600">
                        No exact matches found, but these related questions might help:
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {relatedQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSearchTerm(question.question);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left p-3 bg-white rounded-lg border border-yellow-200 hover:border-yellow-300 hover:bg-yellow-25 transition-colors"
                          >
                            <div className="font-medium text-yellow-800 mb-1">{question.question}</div>
                            <div className="text-sm text-yellow-600">From {question.category}</div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-yellow-200">
                        <p className="text-sm text-yellow-600">
                          Still can't find what you're looking for? Try the AI assistant response above or{' '}
                          <a href="#contact" className="font-medium hover:underline">
                            contact our support team
                          </a>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* No Results Fallback - Only show if no AI answer and no related questions */}
              {searchTerm && filteredFAQs.length === 0 && !showAIAnswer && relatedQuestions.length === 0 && (
                <section className="text-center py-12">
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-brand-dark-text mb-2">
                    No results found
                  </h3>
                  <p className="text-brand-dark-text mb-4">
                    Try searching with different keywords or browse our categories above.
                  </p>
                  <Button 
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    Clear Search
                  </Button>
                </section>
              )}

              {/* Vehicle Coverage Image Section */}
              <section className="my-12">
                <div className="flex justify-center">
                  <img 
                    src="/car-warranty-uk-suv-warranty-uk-2.png" 
                    alt="Car warranty UK SUV warranty - Affordable vehicle protection with savings for cars, motorcycles, and SUVs with panda mascot"
                    className="w-full h-auto max-w-4xl"
                  />
                </div>
              </section>

              {/* Contact Section */}
              <section id="contact" className="bg-white rounded-lg shadow-lg p-8 mt-12">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-brand-dark-text mb-4">
                    Still Need Help?
                  </h2>
                  <p className="text-brand-dark-text mb-6">
                    Can't find the answer you're looking for? Our friendly team is here to help.
                  </p>
                  
                  <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex items-start gap-3 text-left">
                      <Phone className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-brand-dark-text">
                          Call Us
                        </p>
                        <a href="tel:03302295040" className="text-primary hover:underline">
                          Phone: 0330 229 5040
                        </a>
                        <span className="text-brand-dark-text"> | </span>
                        <a href="tel:03302295045" className="text-primary hover:underline">
                          Claims: 0330 229 5045
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 text-left">
                      <Mail className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-brand-dark-text">
                          Email Us
                        </p>
                        <a href="mailto:support@buyawarranty.co.uk" className="text-primary hover:underline">
                          support@buyawarranty.co.uk
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 text-sm text-brand-dark-text">
                    <p>Monday to Friday, 9am to 5pm</p>
                  </div>
                </div>
              </section>

              {/* Complaints Section */}
              <section className="bg-gray-100 rounded-lg p-6 mt-8">
                <h3 className="font-bold text-lg text-brand-dark-text mb-3">
                  Have a Complaint?
                </h3>
                <p className="text-brand-dark-text">
                  We take complaints very seriously. Our UK-based team will look into it properly. 
                  Please email us at{' '}
                  <a 
                    href="mailto:info@buyawarranty.co.uk" 
                    className="text-primary hover:text-primary/80 transition-colors underline"
                  >
                    info@buyawarranty.co.uk
                  </a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FAQ;