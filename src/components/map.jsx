import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimerMixin from 'react-timer-mixin';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import $ from 'jquery';

import lastLocation from '../location';
import { Search } from './mapper/Search';
import GraphMapPane from './mapper/GraphMapPane';
import { useGraphMapper } from './mapper/useGraphMapper';
import { t } from './mapper/i18n.js';
import './mapper/mapper.css';

const useLocation = () => {
  const [location, setLocation] = useState(lastLocation() || {});

  useEffect(() => {
    if ('BroadcastChannel' in window) {
      const locationChannel = new BroadcastChannel('location');
      locationChannel.onmessage = e => {
        if (e.data.what === 'location') {
          const next = e.data.location || {};
          // location.js re-broadcasts on EVERY rpc-prompt, so most messages repeat the
          // same area+vnum. Keep the previous object identity when nothing changed — a
          // fresh reference re-renders the whole map tree (incl. the heavy d3 graph) on
          // every prompt, which is what made movement/typing hang.
          setLocation(prev =>
            prev && prev.area === next.area && prev.vnum === next.vnum ? prev : next
          );
        }
      };
      return () => locationChannel.close();
    }
  }, []);

  return location;
};

const useMapSource = location => {
  const [mapSource, setMapSource] = useState();

  useEffect(() => {
    if (!location.area || location.area === '') return;

    const mapName = location.area.replace(/are$/, 'html');
    const mapUrl = `/maps/sources/${mapName}`;

    $.get(mapUrl)
      .then(map =>
        setMapSource(
          map.replaceAll(
            /<a href=".*?\.html">(.*?)<\/a>/g,
            '<span class="fgdc">$1</span>'
          )
        )
      )
      .catch(e => {
        console.log('Map error', e);
        setMapSource('');
      });
  }, [location.area]);

  return mapSource;
};

const useAreaData = () => {
  const [areaData, setAreaData] = useState({});
  const areasUrl = `/maps/index.json`;

  const refreshAreaData = useCallback(() => {
    console.log('Refreshing area data...');

    fetch(areasUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Data is not an array');
        }

        setAreaData(
          data.reduce((map, obj) => {
            map[obj.file] = obj.name;
            return map;
          }, {})
        );
      })
      .catch(e => {
        console.error('Error fetching', areasUrl, e);
        setAreaData({});
      });
  }, [areasUrl]);

  useEffect(() => {
    const refreshTimeout = 1000 * 60 * 15;
    refreshAreaData();
    TimerMixin.setInterval(refreshAreaData, refreshTimeout);
  }, [refreshAreaData]);

  return areaData;
};

/**
 * Legacy ASCII map body — the original mudjs map, fetched as pre-rendered HTML from
 * /maps/sources/*.html and highlighted on the active room. Untouched behaviour; only
 * lifted out of the top-level component so it (and its fetch) mount solely in ASCII mode.
 */
const AsciiMapBody = ({ location, apiRef }) => {
  const mapSource = useMapSource(location);
  const mapElement = useRef(null);

  const recenterPosition = () => {
    const $active = $(mapElement.current).find('.room.active');
    if (!$active.length) return;
    $active.get(0).scrollIntoView({ block: 'center', inline: 'center' });
  };

  const highlightPosition = useCallback(() => {
    const room = location.vnum;
    $(mapElement.current).find('.room').removeClass('active');

    if (room && room !== '') {
      $(mapElement.current).find(`.room-${room}`).addClass('active');
      recenterPosition();
    }
  }, [location.vnum]);

  const mapFontSizeKey = 'map-font-size';

  useEffect(() => {
    const cacheFontSize = localStorage.getItem(mapFontSizeKey);
    if (cacheFontSize != null) {
      $(mapElement.current).css('font-size', cacheFontSize + 'px');
    }
  }, []);

  const changeFontSize = delta => {
    const map = $(mapElement.current);
    const style = map.css('font-size');
    const fontSize = parseFloat(style);
    map.css('font-size', fontSize + delta + 'px');
    localStorage.setItem(mapFontSizeKey, fontSize + delta);
    recenterPosition();
  };

  useEffect(() => {
    $(mapElement.current).html(mapSource);
    highlightPosition();
  }, [mapSource, highlightPosition]);

  useEffect(() => {
    highlightPosition();
  }, [location.vnum, highlightPosition]);

  // Publish the font-size control so the shared topbar +/- can drive ASCII-mode zoom.
  useEffect(() => {
    if (apiRef) apiRef.current = { changeFont: changeFontSize };
    return () => {
      if (apiRef) apiRef.current = null;
    };
  });

  // useMapSource resolves to '' on fetch failure or an empty body. Without a notice the
  // <pre> just renders blank, which reads as a broken panel; show why the map is missing.
  const mapUnavailable = mapSource === '';

  return (
    <div id="map-wrap">
      <div id="map">
        {mapUnavailable && (
          <div className="dl-mapper-notice">
            <p>{t.noAsciiMap}</p>
          </div>
        )}
        <pre ref={mapElement} />
      </div>
    </div>
  );
};

/** Compact z-layer picker shown in the topbar for multi-level zones (graph mode). */
const LayerSelect = ({ layout, zFilter, onChange }) => {
  if (!layout || layout.zLayers.length <= 1) return null;
  return (
    <select
      className="select select--small"
      value={zFilter === 'all' ? 'all' : String(zFilter)}
      onChange={e => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
      aria-label={t.zLayerFilter}
    >
      <option value="all">{t.allLayers}</option>
      {layout.zLayers.map(z => (
        <option key={z} value={z}>
          {z >= 0 ? `+${z}` : z}
        </option>
      ))}
    </select>
  );
};

export default function Map() {
  const location = useLocation();
  const areaData = useAreaData();
  const areaName = areaData[location.area || ''] || '';

  // 'graph' = new DL mapper (default); 'ascii' = legacy HTML map. Persisted per-browser.
  const [mode, setMode] = useState(() => localStorage.getItem('map-mode') || 'graph');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const graph = useGraphMapper(location, mode === 'graph');

  const setModePersisted = useCallback(next => {
    setMode(next);
    localStorage.setItem('map-mode', next);
  }, []);

  // The +/- live in the topbar (right of the # toggle) and drive whichever body is active:
  // d3 zoom in graph mode, ASCII font size in ASCII mode. Each body publishes its handle.
  const zoomApiRef = useRef(null);
  const asciiApiRef = useRef(null);
  const handleZoomIn = useCallback(() => {
    if (mode === 'graph') zoomApiRef.current?.zoomBy(1.3);
    else asciiApiRef.current?.changeFont(1);
  }, [mode]);
  const handleZoomOut = useCallback(() => {
    if (mode === 'graph') zoomApiRef.current?.zoomBy(1 / 1.3);
    else asciiApiRef.current?.changeFont(-1);
  }, [mode]);

  // User-driven room inspect (tile click / search pick): select + reveal the detail drawer.
  // setSelectedVnum is a stable useState setter, so this stays referentially stable and
  // doesn't force the heavy d3 <Map> to re-render on every parent tick.
  const handleSelectRoom = useCallback(
    vnum => {
      graph.setSelectedVnum(vnum);
      setDrawerOpen(true);
    },
    [graph.setSelectedVnum]
  );

  // v1: the displayed zone is always the player's zone, so cross-area exits are badges
  // only -- walking through them happens in-game and the map follows automatically.
  const handleCrossArea = useCallback(() => {}, []);

  // Stable so memo(GraphMapPane) isn't defeated by a fresh inline closure each render.
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleRequestAscii = useCallback(() => setModePersisted('ascii'), [setModePersisted]);

  const graphReady = mode === 'graph' && graph.status === 'ready' && graph.layout != null;

  return (
    <div className="dl-mapper-root">
      <AppBar
        position="absolute"
        elevation={0}
        sx={{
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          boxSizing: 'border-box',
          zIndex: 500,
          backgroundColor: '#1e1e1e',
          backgroundImage: 'none', // kill MUI's dark-mode elevation overlay so it stays flat
          boxShadow: 'none',
        }}
        color="default"
      >
        <Toolbar variant="dense" className="dl-mapper-topbar">
          <Typography id="areaName" className="dl-mapper-areaname" sx={{ color: '#BB86FC' }}>
            {areaName}
          </Typography>

          {graphReady && (
            <>
              <Search layout={graph.layout} onPick={handleSelectRoom} />
              <LayerSelect
                layout={graph.layout}
                zFilter={graph.zFilter}
                onChange={graph.setZFilter}
              />
            </>
          )}

          <button
            type="button"
            className={`toggle-btn${mode === 'ascii' ? ' is-on' : ''}`}
            aria-pressed={mode === 'ascii'}
            aria-label="ASCII"
            title="ASCII"
            onClick={() => setModePersisted(mode === 'ascii' ? 'graph' : 'ascii')}
          >
            #
          </button>
          <button
            type="button"
            className="dl-mapper-zoom-btn"
            aria-label="zoom in"
            onClick={handleZoomIn}
          >
            +
          </button>
          <button
            type="button"
            className="dl-mapper-zoom-btn"
            aria-label="zoom out"
            onClick={handleZoomOut}
          >
            −
          </button>
        </Toolbar>
      </AppBar>

      {mode === 'ascii' ? (
        <AsciiMapBody location={location} apiRef={asciiApiRef} />
      ) : (
        <GraphMapPane
          zoomApiRef={zoomApiRef}
          index={graph.index}
          layout={graph.layout}
          status={graph.status}
          currentVnum={graph.currentVnum}
          selectedVnum={graph.selectedVnum}
          activeZ={graph.activeZ}
          zFilter={graph.zFilter}
          onSelectRoom={handleSelectRoom}
          onRunTo={graph.runTo}
          onWalk={graph.walk}
          onChangeZ={graph.setZFilter}
          onCrossArea={handleCrossArea}
          drawerOpen={drawerOpen}
          onCloseDrawer={handleCloseDrawer}
          onRequestAscii={handleRequestAscii}
          toast={graph.toast}
        />
      )}
    </div>
  );
}
