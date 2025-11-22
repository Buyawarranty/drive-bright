const paylaterSettings = window.wc.wcSettings.getSetting('bumperpay_paylater_data', {});
const paylaterLabel = window.wp.htmlEntities.decodeEntities(paylaterSettings.title) || window.wp.i18n.__('Spread the cost', 'wc-bumperpay');

// Define translations for specific languages
const translations = {
    en: 'Credit subject to status. 18+, UK only. <a href="https://www.bumper.co/terms" target="_blank">T&amp;Cs apply</a>',
    ie: 'Credit subject to status. 18+, ROI only. <a href="https://www.bumper.co/ie/terms" target="_blank">T&amp;Cs apply</a>',
    es: 'PayLater es un contrato de crédito no regulado proporcionado por Bumper International Limited. No cobramos comisión de apertura ni intereses. Se aplicarán comisiones por demora en el pago. Pedir prestado más de lo que uno puede pagar, pagar con retraso o no pagar puede afectar a su perfil crediticio y, por ende, a su capacidad para pedir préstamos en el futuro. Sujeto a condiciones, mayores de 18 años, sólo residentes en España. Se aplican los términos y condiciones generales.',
    'de-DE': 'Für alle Anträge wird die Bonitätsauskunft des Antragstellers bei der Schufa abgefragt. Der Antragsteller muss 18 Jahre oder älter sein. Nur bei teilnehmenden Betrieben. Der Vertrag und die Geschäftsbedingungen sind bei Antragstellung erhältlich.',
    'nl-NL': 'PayLater is een ongereguleerde kredietvorm die wordt aangeboden door Bumper International Limited. Er zijn geen rente of andere kosten. Er zijn kosten voor te late betaling van toepassing. Meer lenen dan u zich kunt veroorloven, te laat betalen of ontbrekende betalingen kunnen van invloed zijn op uw kredietscore en uw vermogen om in de toekomst te lenen. Onder voorbehoud van status, 18+, alleen inwoners van NL. Algemene voorwaarden zijn van toepassing.'
};

// Function to get the translation based on the current language
const getTranslation = (lang) => {
    return translations[lang] || translations.en; // Default to English if no translation is available
};

// Get the current site language (you may need to adjust this based on your environment)
const currentLang = document.documentElement.lang || 'en'; // Assuming the site language is set in the <html> tag

// Get the translated description
const paylaterDescription = getTranslation(currentLang);

const PayLaterContent = () => {
    return window.wp.element.createElement(
        'div',
        null,
        window.wp.element.createElement('div', {
            dangerouslySetInnerHTML: { __html: window.wp.htmlEntities.decodeEntities(paylaterDescription) }
        }),
        window.wp.element.createElement('input', { type: 'hidden', name: 'payment_type_hidden', value: 'paylater' })
    );
};

const PayLaterGateway = {
    name: 'bumperpay_paylater',
    label: window.wp.element.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } },
        window.wp.element.createElement('span', null, paylaterLabel),
        window.wp.element.createElement('img', { 
            src: 'https://bumper-live-public.s3.eu-west-1.amazonaws.com/images/logos/bumper-main.svg', 
            alt: 'Bumper Logo', 
            style: { maxWidth: '40%', height: 'auto' }
        })
    ),
    content: window.wp.element.createElement(PayLaterContent, null),
    edit: window.wp.element.createElement(PayLaterContent, null),
    canMakePayment: () => true,
    ariaLabel: paylaterLabel,
    supports: {
        features: paylaterSettings.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod(PayLaterGateway);