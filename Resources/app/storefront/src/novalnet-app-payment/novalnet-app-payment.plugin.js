import Plugin from 'src/plugin-system/plugin.class';
import PageLoadingIndicatorUtil from 'src/utility/loading-indicator/page-loading-indicator.util';
import CookieStorageHelper from 'src/helper/storage/cookie-storage.helper';
import HttpClient from 'src/service/http-client.service';
import FormSerializeUtil from 'src/utility/form/form-serialize.util';
import DomAccess from 'src/helper/dom-access.helper';
import ButtonLoadingIndicator from 'src/utility/loading-indicator/button-loading-indicator.util';

export default class NovalnetAppPayment extends Plugin {
    init() {
        this._createScript((function() {
            var paymentMethods = document.querySelectorAll('input[name="paymentMethodId"]'),
                selectedPaymentId = document.querySelector('input[name=paymentMethodId]:checked'),
                nnPaymentId = document.querySelector("#nnAppPaymentId"),
                submitButton = document.querySelector('#confirmOrderForm button[type="submit"]'),
                me          = this,
                paymentForm = new NovalnetPaymentForm(),
                cookieName  = "nnPaymentNameCookie",
                client      = new HttpClient(),
                c           = CookieStorageHelper.getItem(cookieName),
                form = nnPaymentId.closest('form');


            var walletConfiguration = DomAccess.getDataAttribute(me.el, 'data-lineitems', false);

            var nnCheckPayment = true;

            if(nnPaymentId.value === selectedPaymentId.value)
            {
                nnCheckPayment = false;
            }

            fetch("https://extapi.novalnet.de/shopware/public/nn/loadIframe", {
                method: "POST",
                body: JSON.stringify({
                    customerId: document.querySelector("#customerId").value,
                    languageId: document.querySelector("#languageId").value,
                    currency: document.querySelector("#nnCurrency").value,
                    amount: document.querySelector("#nnAmount").value,
                    shopId: document.querySelector("#shopId").value
                })
            }).then((function(e) {
                return e.json()
            }
            )).then((function(e) {
                if(e.result.status == "FAILURE" || e.result.status_code != 100)
                {
                    alert(e.result.additional_message);
                    document.getElementById("novalnetV13Iframe").style.display = 'none';
                } else {
                    document.getElementById("novalnetV13Iframe").style.background = 'unset';
                    document.getElementById("novalnetV13Iframe").src = e.result.redirect_url;
                }
            }
            )).catch((function(e) {
                document.getElementById("novalnetV13Iframe").style.display = 'none';
                console.error("Error:", e)
            }
            ));

            if (CookieStorageHelper.getItem(cookieName) !== false && CookieStorageHelper.getItem(cookieName) !== undefined && !nnCheckPayment && nnPaymentId.value === selectedPaymentId.value)
            {
                let request = {
                    iframe: "#novalnetV13Iframe",
                    initForm: {
                        orderInformation : {
                            lineItems: walletConfiguration
                        },
                        checkPayment: c,
                        uncheckPayments: false,
                        setWalletPending: true,
                        showButton: false
                    }
                };

                paymentForm.initiate(request);

                paymentForm.validationResponse((data) => {
                    paymentForm.initiate(request);
                });

            } else {
                let request = {
                    iframe: "#novalnetV13Iframe",
                    initForm: {
                        orderInformation : {
                            lineItems: walletConfiguration
                        },
                        uncheckPayments: nnCheckPayment,
                        setWalletPending: true,
                        showButton: false
                    }
                };

                paymentForm.initiate(request);

                paymentForm.validationResponse((data) => {
                    paymentForm.initiate(request);
                });
            }

            paymentForm.selectedPayment((function(t) {
                CookieStorageHelper.setItem(cookieName, t.payment_details.type);
                if (nnPaymentId.value !== selectedPaymentId.value)
                {
                    PageLoadingIndicatorUtil.create();
                    document.querySelector('#paymentMethod' + nnPaymentId.value).checked = true;
                    const data = FormSerializeUtil.serialize(form);
                    const action = form.getAttribute('action');

                    client.post(action, data, response => {
                        PageLoadingIndicatorUtil.remove();
                        window.PluginManager.initializePlugins();
                        document.querySelector("#nnAppPaymentId").closest('form').submit();
                    });
                }
                
                if (t.payment_details.type == 'GOOGLEPAY' || t.payment_details.type == 'APPLEPAY')
                {
                    submitButton.style.display = "none";
                } else {
                    submitButton.style.display = "block";
                }
            }));

            // receive wallet payment Response like gpay and applepay
            paymentForm.walletResponse({
                onProcessCompletion: function (response){
                    if (response.result.status == 'SUCCESS') {
                        var tosInput = document.querySelector('#tos');

                        if(tosInput != undefined && !tosInput.checked)
                        {
                            return {status: 'FAILURE', statusText: 'failure'};
                        }
                        document.querySelector('#novalnetapp-paymentdata').value = JSON.stringify(response);
                        
                        me._createPreparedRequest("/store-api/script/customer-update", JSON.stringify({
                            paymentData: JSON.stringify(response),
                            customerId: document.querySelector("#customerId").value
                        }));
                        
                        setTimeout(function() {
                            fetch("https://extapi.novalnet.de/shopware/public/novalnet/saveSession", {
                                method: "POST",
                                body: JSON.stringify({
                                    paymentData: JSON.stringify(response),
                                    shopId: document.querySelector("#shopId").value,
                                    customerNo: document.querySelector("#customerNo").value
                                })
                            }).then((function(e) {
                            }
                            )).catch((function(e) {
                            }
                            ));
                            document.querySelector('#confirmOrderForm').submit();
                        }, 500);
                        return {status: 'SUCCESS', statusText: 'successfull'};
                    } else {
                        return {status: 'FAILURE', statusText: 'failure'};
                    }
                }
            });

            submitButton.addEventListener('click', (event) => {
                if(nnPaymentId.value === selectedPaymentId.value)
                {
                    var tosInput = document.querySelector('#tos');

                    if(tosInput != undefined && !tosInput.checked)
                    {
                        return false;
                    }
                    
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    if(document.getElementById("confirmFormSubmit") != undefined)
                    {
                        document.getElementById("confirmFormSubmit").disabled = true;
                        const loader = new ButtonLoadingIndicator(document.getElementById("confirmFormSubmit"));
                        loader.create();
                    } else {
                        var submitButton = document.querySelector('#confirmOrderForm button[type="submit"]');
                        submitButton.disabled = true;
                        const loader = new ButtonLoadingIndicator(submitButton);
                        loader.create();
                    }
                    
                    paymentForm.getPayment((function(p) {
                        if (p.result.statusCode == '100' || p.result.status == 'SUCCESS')
                        {
                            if ((p.payment_details.key != undefined && p.payment_details.key != null) || (p.payment_details.id != undefined && p.payment_details.id != null))
                            {
                                document.querySelector('#novalnetapp-paymentdata').value = JSON.stringify(p);
                                
                                me._createPreparedRequest("/store-api/script/customer-update", JSON.stringify({
                                    paymentData: JSON.stringify(p),
                                    customerId: document.querySelector("#customerId").value
                                }));

                                setTimeout(function() {
                                fetch("https://extapi.novalnet.de/shopware/public/novalnet/saveSession", {
                                        method: "POST",
                                        body: JSON.stringify({
                                            paymentData: JSON.stringify(p),
                                            shopId: document.querySelector("#shopId").value,
                                            customerNo: document.querySelector("#customerNo").value
                                        })
                                    }).then((function(e) {
                                    }
                                    )).catch((function(e) {
                                    }
                                    ));
                                    document.querySelector('#confirmOrderForm').submit();
                                }, 500);
                            } else {
                                me._displayErrorMsg('Please select any payment method');
                                me._showSubmitForm();
                            }
                        } else {
                            me._displayErrorMsg(p.result.message);
                            me._showSubmitForm();
                        }
                    }
                    ));
                }
            });
        }
        ));
    }

    _createScript(callback) {
        const url = 'https://cdn.novalnet.de/js/pv13/checkout.js?' + Math.floor(Math.random() * 1000009);
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.addEventListener('load', callback.bind(this), false);
        document.head.appendChild(script);
    }

    _displayErrorMsg(errorMessage) {
        document.querySelector('.flashbags').innerHTML = '';
        var parentDiv  = document.createElement('div');
        var childDiv1  = document.createElement('div');
        var childDiv2  = document.createElement('div');
        var spanTag    = document.createElement('span');
        parentDiv.className= "alert alert-danger alert-has-icon";childDiv1.className= "alert-content-container";childDiv2.className= "alert-content";spanTag.className= "icon icon-blocked";
        spanTag.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24"><defs><path d="M12 24C5.3726 24 0 18.6274 0 12S5.3726 0 12 0s12 5.3726 12 12-5.3726 12-12 12zm0-2c5.5228 0 10-4.4772 10-10S17.5228 2 12 2 2 6.4772 2 12s4.4772 10 10 10zm4.2929-15.7071c.3905-.3905 1.0237-.3905 1.4142 0 .3905.3905.3905 1.0237 0 1.4142l-10 10c-.3905.3905-1.0237.3905-1.4142 0-.3905-.3905-.3905-1.0237 0-1.4142l10-10z" id="icons-default-blocked"></path></defs><use xlink:href="#icons-default-blocked" fill="#758CA3" fill-rule="evenodd"></use></svg>';
        parentDiv.appendChild(spanTag);parentDiv.appendChild(childDiv1);childDiv1.appendChild(childDiv2);
        childDiv2.innerHTML = errorMessage;
        document.querySelector('.flashbags').appendChild(parentDiv);
        document.querySelector('.flashbags').scrollIntoView();
    }

    _showSubmitForm() {
        if(document.getElementById("confirmFormSubmit") != undefined)
        {
            document.getElementById("confirmFormSubmit").disabled = false;
            const loader = new ButtonLoadingIndicator(document.getElementById("confirmFormSubmit"));
            loader.remove();
        } else {
            var submitButton = document.querySelector('#confirmOrderForm button[type="submit"]');
            submitButton.disabled = false;
            const loader = new ButtonLoadingIndicator(submitButton);
            loader.remove();
        }
    }
    
    _createPreparedRequest(url, data) {
        const request = new XMLHttpRequest();

        request.open('POST', url);
        request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        request.setRequestHeader('Content-type', 'application/json');
        request.setRequestHeader('sw-access-key', document.querySelector('#nnToken').value);
        return request.send(data);
    }
}
