import type { AreaLayout, MapperIndex } from './types.js';
import { sectorLabel, sectorStyle } from './sectors.js';
import { t } from './i18n.js';

interface Props {
  layout: AreaLayout;
  index: MapperIndex;
  vnum: number | null;
  currentVnum: number | null;
  onSetCurrent: (vnum: number) => void;
  onRunTo: (vnum: number) => void;
  /** Host integration: when present, a close (×) button is shown in the header row. */
  onClose?: () => void;
  /** Walk one step in a direction — used to make cross-area exits clickable. */
  onWalk?: (dir: string) => void;
}

/** A single emoji summarising an exit: lock / door for door state, fish / bird for the
 * destination terrain. Empty for a plain open exit. */
function exitEmoji(flags: string[], targetSector?: string): string {
  if (flags.includes('locked') || flags.includes('pickproof')) return '🔒';
  if (flags.includes('isdoor') || flags.includes('closed') || flags.includes('door')) return '🚪';
  if (targetSector === 'underwater') return '🐟';
  if (targetSector === 'air') return '🐦';
  return '';
}

export function SidePanel({ layout, index, vnum, currentVnum, onSetCurrent, onRunTo, onClose, onWalk }: Props) {
  if (vnum == null) {
    return (
      <div className="panel">
        <p className="panel-empty">{t.clickRoom}</p>
      </div>
    );
  }
  const room = layout.rooms[vnum];
  const placed = layout.placed[vnum];
  if (!room) return <div className="panel"><p className="panel-empty">{t.roomNotLoaded}</p></div>;
  const z = placed?.z ?? 0;
  const zText = z === 0 ? '0' : z > 0 ? `+${z}` : `${z}`;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="panel-title">{room.name || t.unnamed}</h2>
        <div className="panel-head-right">
          <span className="panel-meta">
            {sectorLabel(room.sector)} / {t.layer} {zText}
          </span>
          {onClose && (
            <button
              type="button"
              className="panel-close"
              aria-label={t.closePanel}
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {placed?.isVoid && (
        <div className="panel-void">
          {t.voidHere(placed.voidReason || t.unmapped)}
        </div>
      )}

      <section className="section">
        <div className="section-label">{t.exits}</div>
        {room.exits.length === 0 ? (
          <div className="exits-empty">{t.noExits}</div>
        ) : (
          <ul className="exits">
            {room.exits.map((ex, i) => {
              const targetRoom = layout.rooms[ex.target];
              // Cross-area target: resolve the destination zone's localized name.
              const crossFile = targetRoom ? undefined : index.vnumToArea[ex.target];
              const crossZone = crossFile ? index.areas.find((a) => a.file === crossFile)?.name : undefined;
              const tgtName = targetRoom?.name || crossZone || t.anotherArea;
              // Colour the destination by its sector (indoors → inside), matching the map tiles.
              const tgtColor = targetRoom
                ? sectorStyle(targetRoom.flags.includes('indoors') ? 'inside' : targetRoom.sector).text
                : undefined;
              return (
                <li key={i} className="exit">
                  <span className="exit-dir">{t.dir[ex.dir] ?? ex.dir}</span>
                  <span className="exit-target">
                    {targetRoom ? (
                      <button className="exit-target-link" style={{ color: tgtColor }} onClick={() => onSetCurrent(ex.target)}>
                        {tgtName}
                      </button>
                    ) : (
                      <button
                        className="exit-target-link exit-target-cross"
                        onClick={() => onWalk && onWalk(ex.dir)}
                      >
                        {tgtName}
                      </button>
                    )}
                    {(() => {
                      const emoji = exitEmoji(ex.flags, targetRoom?.sector);
                      return emoji ? <span className="exit-emoji" aria-hidden="true">{emoji}</span> : null;
                    })()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {room.description && (
        <section className="section">
          <div className="description">{room.description}</div>
        </section>
      )}

      {currentVnum != null && currentVnum !== vnum && (
        <div className="panel-actions">
          <button className="btn btn--primary" onClick={() => onRunTo(vnum)}>
            {t.runHere}
          </button>
        </div>
      )}
    </div>
  );
}
