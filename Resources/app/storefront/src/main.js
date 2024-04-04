// import all necessary storefront plugins
import NovalnetAppPayment from './novalnet-app-payment/novalnet-app-payment.plugin';

// register them via the existing PluginManager
const PluginManager = window.PluginManager;
PluginManager.register('NovalnetAppPayment', NovalnetAppPayment, '#novalnet-app-payment-script');
