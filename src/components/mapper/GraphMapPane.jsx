/**
 * GraphMapPane — the graphical map body inside the mudjs `map` mosaic tile.
 *
 * Pure presentation: the shell (../map.jsx) owns the data via useGraphMapper and the
 * topbar controls (Search / layer select / ASCII toggle). Here we render the d3 <Map>
 * and, since the tile is too narrow for a docked 340px aside, the room detail <SidePanel>
 * lives in a bottom overlay-drawer that slides over the map and is dismissable.
 */
import { Map as GraphMap } from './Map';
import { SidePanel } from './SidePanel';
import { t } from './i18n.js';

export default function GraphMapPane({
  zoomApiRef,
  index,
  layout,
  status,
  currentVnum,
  selectedVnum,
  activeZ,
  zFilter,
  onSelectRoom,
  onRunTo,
  onWalk,
  onChangeZ,
  onCrossArea,
  drawerOpen,
  onCloseDrawer,
  onRequestAscii,
  toast,
}) {
  // No graph for this area (the mapper covers a subset of zones) or a load error:
  // nudge the player to the always-available legacy ASCII map.
  if (status === 'missing' || status === 'error') {
    return (
      <div className="dl-mapper dl-mapper-fallback">
        <div className="dl-mapper-notice">
          <p>{status === 'missing' ? t.noGraphMap : t.graphMapError}</p>
          <button type="button" className="btn" onClick={onRequestAscii}>
            {t.showAscii}
          </button>
        </div>
      </div>
    );
  }

  // <Map> and <SidePanel> dereference index (cross-area resolution), so hold the render
  // until both the area layout and the index have resolved.
  if (layout == null || index == null) {
    return (
      <div className="dl-mapper dl-mapper-fallback">
        <div className="loading">{t.loadingArea}</div>
      </div>
    );
  }

  return (
    <div className="dl-mapper">
      <GraphMap
        layout={layout}
        index={index}
        currentVnum={currentVnum}
        selectedVnum={selectedVnum}
        activeZ={activeZ}
        zFilter={zFilter}
        onSelectRoom={onSelectRoom}
        onSetCurrent={onRunTo}
        onCrossArea={onCrossArea}
        onChangeZ={onChangeZ}
        zoomApiRef={zoomApiRef}
      />

      <div className="dl-mapper-drawer" data-open={drawerOpen ? 'true' : 'false'}>
        <div className="dl-mapper-drawer-body">
          <SidePanel
            layout={layout}
            index={index}
            vnum={selectedVnum}
            currentVnum={currentVnum}
            onClose={onCloseDrawer}
            onSetCurrent={onSelectRoom}
            onRunTo={onRunTo}
            onWalk={onWalk}
          />
        </div>
      </div>

      {toast && (
        <div role="status" className="toast">{toast}</div>
      )}
    </div>
  );
}
