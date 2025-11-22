const paynowSettings = window.wc.wcSettings.getSetting('bumperpay_paynow_data', {});
const paynowLabel = window.wp.htmlEntities.decodeEntities(paynowSettings.title) || window.wp.i18n.__('Pay By Card', 'wc-bumperpay');

const PayNowContent = () => {
    return window.wp.element.createElement(
        'div',
        null,
        window.wp.element.createElement('input', { type: 'hidden', name: 'paynow_hidden', value: 'paynow' })
    );
};

const PayNowGateway = {
    name: 'bumperpay_paynow',
    label: window.wp.element.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } },
        window.wp.element.createElement('span', null, paynowLabel),
        window.wp.element.createElement('img', { 
            src: 'https://bumper-live-public.s3.eu-west-1.amazonaws.com/images/logos/bumper-main.svg', 
            alt: 'Bumper Logo', 
            style: { maxWidth: '40%', height: 'auto' }
        })
    ),
    content: window.wp.element.createElement(PayNowContent, null),
    edit: window.wp.element.createElement(PayNowContent, null),
    canMakePayment: () => true,
    ariaLabel: paynowLabel,
    supports: {
        features: paynowSettings.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod(PayNowGateway);