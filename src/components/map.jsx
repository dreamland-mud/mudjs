import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimerMixin from 'react-timer-mixin';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Add, Remove } from '@mui/icons-material';
import $ from 'jquery';

import lastLocation from '../location';

const useLocation = () => {
  const [location, setLocation] = useState(lastLocation() || {});

  useEffect(() => {
    if ('BroadcastChannel' in window) {
      const locationChannel = new BroadcastChannel('location');
      locationChannel.onmessage = e => {
        if (e.data.what === 'location') {
          setLocation(e.data.location);
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

const MapControls = ({ changeFontSize }) => {
  return (
    <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 500 }}>
      <ButtonGroup
        variant="contained"
        size="small"
        orientation="vertical"
        color="primary"
        aria-label="map resize buttons"
      >
        <Button onClick={() => changeFontSize(1)}>
          <Add />
        </Button>
        <Button onClick={() => changeFontSize(-1)}>
          <Remove />
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default function Map() {
  const location = useLocation();
  const mapSource = useMapSource(location);
  const areaData = useAreaData();
  const areaName = areaData[location.area || ''] || '';
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

  return (
    <>
      <AppBar
        position="absolute"
        sx={{ top: 0, left: 0, zIndex: 500, backgroundColor: '#2e2e2e' }}
        color="default"
      >
        <Toolbar variant="dense">
          <Typography id="areaName" sx={{ flexGrow: 1, color: '#BB86FC' }}>
            {areaName}
          </Typography>
        </Toolbar>
      </AppBar>
      <MapControls changeFontSize={changeFontSize} />
      <div id="map-wrap">
        <div id="map">
          <pre ref={mapElement} />
        </div>
      </div>
    </>
  );
}
