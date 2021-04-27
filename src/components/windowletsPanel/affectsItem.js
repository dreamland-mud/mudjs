import React from 'react'
import PanelItem from './panelItem'
import { Cnames, Dnames, Enames, Pnames, Tnames, Mnames } from './windowletsConstants';

// prompt affect helper function: draw a block of affects
// prompt affect block fields: a - active bits, z - bits from affects with zero duration
function AffectBlock(props) {
    const clr_active = 'fg-ansi-bright-color-' + props.color
    const clr_zero = 'fg-ansi-bright-color-3'
    const clr_header = 'fg-ansi-bright-color-7'

    let rows = []
    for (let bit in props.bitNames) {
        if (props.bitNames.hasOwnProperty(bit)) {
            let clr

            // Draw active affect names in green, those about to
            // disappear in yellow.
            if (props.block.z.indexOf(bit) !== -1)
                clr = clr_zero
            else if (props.block.a.indexOf(bit) !== -1)
                clr = clr_active
            else
                continue

            rows.push(<span key={bit} className={clr}>{props.bitNames[bit]}</span>)
        }
    }

    return (
        <div id={"pa-" + props.type} className="flexcontainer-column" data-hint={"hint-" + props.type}>
            <span className={clr_header}>{props.blockName}</span>
            { rows }
        </div>
    )
}


export default function AffectsItem(prompt) {

    return (
        <PanelItem title="Воздействия на тебе:">
            <div id="player-affects-table" className="flexcontainer-row flexcontainer-wrap " data-hint="hint-affects">
                {(prompt.pro && prompt.pro !== "none") &&
                    <AffectBlock block={prompt.pro} blockName="Защита" bitNames={Pnames} color="2" type="protect" />
                }
                {(prompt.det && prompt.det !== "none") &&
                    <AffectBlock block={prompt.det} blockName="Обнар" bitNames={Dnames} color="2" type="detects" />
                }
                {(prompt.trv && prompt.trv !== "none") &&
                    <AffectBlock block={prompt.trv} blockName="Трансп" bitNames={Tnames} color="2" type="travel" />
                }
                {(prompt.enh && prompt.enh !== "none") &&
                    <AffectBlock block={prompt.enh} blockName="Усилен" bitNames={Enames} color="2" type="enhance" />
                }
                {(prompt.mal && prompt.mal !== "none") &&
                    <AffectBlock block={prompt.mal} blockName="Отриц" bitNames={Mnames} color="1" type="malad" />
                }
                {(prompt.cln && prompt.cln !== "none") &&
                    <AffectBlock block={prompt.cln} blockName="Клан" bitNames={Cnames} color="2" type="clan" />
                }
            </div>
        </PanelItem>
    )
}