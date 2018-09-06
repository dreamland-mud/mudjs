
// these are not real telnet characters, but rather koi2utf versions of them
var TELNET_IAC     = 'Ъ';             /* interpret as command: */
var TELNET_DONT    = 'Ч';             /* you are not to use option */
var TELNET_DO      = 'Щ';             /* please, you use option */
var TELNET_WONT    = 'Э';             /* I won't use option */
var TELNET_WILL    = 'Ш';             /* I will use option */
var TELNET_SB      = 'З';             /* interpret as subnegotiation */
var TELNET_GA      = 'Ы';             /* you may reverse the line */
var TELNET_EL      = 'Ь';             /* erase the current line */
var TELNET_EC      = 'В';             /* erase the current character */
var TELNET_AYT     = 'Ж';             /* are you there */
var TELNET_AO      = 'У';             /* abort output--but let prog finish */
var TELNET_IP      = 'Т';             /* interrupt process--permanently */
var TELNET_BREAK   = 'С';             /* break */
var TELNET_DM      = 'Р';             /* data mark--for connect. cleaning */
var TELNET_NOP     = 'Я';             /* nop */
var TELNET_SE      = 'П';             /* end sub negotiation */
var TELNET_EOR     = 'О';             /* end of record (transparent mode) */

var TNS_NORMAL      = 0;
var TNS_SUBNEG      = 1;
var TNS_SUBNEG_IAC  = 2;


function Telnet () {
    this.telnet_state = TNS_NORMAL;
    this.subneg = '';
}

Telnet.prototype.process = function(b) {
    var s = '';

    for(var i=0;i<b.length;i++) {
        switch(this.telnet_state) {
            case TNS_NORMAL:
                switch(b.charAt(i)) {
                    case TELNET_IAC:
                        this.telnet_state = TELNET_IAC;
                        break;
                    default:
                        s += b.charAt(i);
                }
                break;

            case TELNET_IAC:
                switch(b.charAt(i)) {
                    case TELNET_DONT:
                    case TELNET_DO:
                    case TELNET_WONT:
                    case TELNET_WILL:
                        this.telnet_state = b.charAt(i);
                        break;

                    case TELNET_SB:
                        this.subneg = '';
                        this.telnet_state = TNS_SUBNEG;
                        break;

                    case TELNET_IAC:
                        s += b.charAt(i);
                        /* fall through */

                    default:
                        // ignore all unknown commands
                        this.telnet_state = TNS_NORMAL;
                }
                break;

            case TNS_SUBNEG:
                switch(b.charAt(i)) {
                    case TELNET_IAC:
                        this.telnet_state = TNS_SUBNEG_IAC;
                        break;

                    default:
                        this.subneg += b.charAt(i);
                }
                break;

            case TNS_SUBNEG_IAC:
                switch(b.charAt(i)) {
                    case TELNET_IAC:
                        this.subneg += b.charAt(i);
                        this.telnet_state = TNS_SUBNEG;
                        break;

                    case TELNET_SE:
                        this.handleSubneg(this.subneg);
                        this.telnet_state = TNS_NORMAL;
                        break;
                }
                break;

            case TELNET_DONT:
                this.handleDont(b.charAt(i));
                this.telnet_state = TNS_NORMAL;
                break;
            case TELNET_DO:
                this.handleDo(b.charAt(i));
                this.telnet_state = TNS_NORMAL;
                break;
            case TELNET_WONT:
                this.handleWont(b.charAt(i));
                this.telnet_state = TNS_NORMAL;
                break;
            case TELNET_WILL:
                this.handleWill(b.charAt(i));
                this.telnet_state = TNS_NORMAL;
                break;

        }
    }

    if(s) {
        this.handleRaw(s);
    }
};

// Override these:
Telnet.prototype.handleRaw = function(b) {
};
Telnet.prototype.handleDont = function(b) {};
Telnet.prototype.handleDo = function(b) {};
Telnet.prototype.handleWont= function(b) {};
Telnet.prototype.handleWill= function(b) {};
Telnet.prototype.handleSubneg= function(b) {};

module.exports = Telnet;
