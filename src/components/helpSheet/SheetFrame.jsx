import React from 'react';
import './sheet-frame.css';

// The modular frame of the side sheets (the parchment help sheet, the dark
// tool sheets): one corner shape turned four ways, plain side rules and a
// keystone top and bottom. Decoration only. Styles: sheet-frame.css; the
// sheet sets the colour (--dl-frame).
export default function SheetFrame() {
  return (
    <span className="hs-frame" aria-hidden="true">
      <span className="hs-frame__c tl" /><span className="hs-frame__c tr" />
      <span className="hs-frame__c bl" /><span className="hs-frame__c br" />
      <span className="hs-frame__s top" /><span className="hs-frame__s bottom" />
      <span className="hs-frame__s left" /><span className="hs-frame__s right" />
      <span className="hs-frame__k top" /><span className="hs-frame__k bottom" />
    </span>
  );
}
