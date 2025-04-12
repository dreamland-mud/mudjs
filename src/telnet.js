// these are not real telnet characters, but rather koi2utf versions of them
const TELNET_IAC = 'Ъ'; /* interpret as command: */
const TELNET_DONT = 'Ч'; /* you are not to use option */
const TELNET_DO = 'Щ'; /* please, you use option */
const TELNET_WONT = 'Э'; /* I won't use option */
const TELNET_WILL = 'Ш'; /* I will use option */
const TELNET_SB = 'З'; /* interpret as subnegotiation */
const TELNET_SE = 'П'; /* end sub negotiation */

const TNS_NORMAL = 0;
const TNS_SUBNEG = 1;
const TNS_SUBNEG_IAC = 2;

class Telnet {
  constructor() {
    this.telnet_state = TNS_NORMAL;
    this.subneg = '';
  }

  process(b) {
    let s = '';

    for (let i = 0; i < b.length; i++) {
      switch (this.telnet_state) {
        case TNS_NORMAL:
          switch (b.charAt(i)) {
            case TELNET_IAC:
              this.telnet_state = TELNET_IAC;
              break;
            default:
              s += b.charAt(i);
          }
          break;

        case TELNET_IAC:
          switch (b.charAt(i)) {
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
            // fall through

            default:
              this.telnet_state = TNS_NORMAL;
          }
          break;

        case TNS_SUBNEG:
          switch (b.charAt(i)) {
            case TELNET_IAC:
              this.telnet_state = TNS_SUBNEG_IAC;
              break;
            default:
              this.subneg += b.charAt(i);
          }
          break;

        case TNS_SUBNEG_IAC:
          switch (b.charAt(i)) {
            case TELNET_IAC:
              this.subneg += b.charAt(i);
              this.telnet_state = TNS_SUBNEG;
              break;
            case TELNET_SE:
              this.handleSubneg(this.subneg);
              this.telnet_state = TNS_NORMAL;
              break;
            default:
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

        default:
          break;
      }
    }

    if (s) {
      this.handleRaw(s);
    }
  }

  // Override these:
  handleRaw() {}
  handleDont() {}
  handleDo() {}
  handleWont() {}
  handleWill() {}
  handleSubneg() {}
}

export default Telnet;
