import React from 'react';
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from "@material-ui/core/styles";
import { useState, useEffect, useRef } from 'react';
import { Add, Remove } from "@material-ui/icons";
import $ from 'jquery';

const areas = require('../data/areas.json').reduce(function(map, obj) {
    map[obj.file] = obj.name;
    return map;
}, {});

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 500
  },
  title: {
    flexGrow: 1
  },
  appbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 500,
    backgroundColor: '#202f31'
  }

}));

// Invoked from Map's render function every time one of the states it refers to is changed.
const useLocation = () => {
    // TODO call lastLocation() here.
    const [location, setLocation] = useState({}); // pass something so that location is never null.
    console.log('>>> useLocation', location);

    // Called only once on Map's componentDidMount, to subscribe to the channel.
    useEffect(() => {
        console.log('>>> useEffect([])');
        if ('BroadcastChannel' in window) {
            const locationChannel = new BroadcastChannel('location');

            locationChannel.onmessage = e => { 
                if (e.data.what === 'location') { 
                    setLocation(e.data.location);
                }
            }

            // Stop reacting to messages when a component is unmounted.
            return () => locationChannel.close();
        }

    }, []);

    return location;
};

// Invoked from Map's render function every time one of the states it refers to is changed.
const useMapSource = (location) => {
    console.log('>>> useMapSource', location);
    const [mapSource, setMapSource] = useState();

    // Called every time a location's area is changed.
    useEffect(() => {
        console.log('>>> useEffect(area)', location);
        if (!location.area || location.area === '')
            return;

        let mapName = location.area.replace(/are$/, 'html');
        let mapUrl = `/maps/sources/${mapName}`;

        $.get(mapUrl)
            .then(setMapSource)
            .catch(e => {
                console.log('Map error', e);
                setMapSource('');
            });
       
    }, [location.area]);

    return mapSource;
};

const MapControls = props => {
    const classes = useStyles();

    return (
        <div className={classes.root}>
            <ButtonGroup variant="contained" size="small" orientation="vertical" color="primary" aria-label="map resize buttons">
                <Button onClick={() => { props.changeFontSize(1) }}> <Add /> </Button>
                <Button onClick={() => { props.changeFontSize(-1) }}> <Remove /> </Button>
            </ButtonGroup>
        </div>
    );
};
    
export default function Map(props) {
    console.log('>>> Map.render');
    const classes = useStyles();
    const location = useLocation();
    const mapSource = useMapSource(location);
    const mapElement = useRef(null);
    let areaName = areas[location.area || ''] || '';

    // Scroll map window so that the active room is in the center.
    const recenterPosition = () => {
        var $active = $(mapElement.current).find('.room.active');
        if (!$active.length)
            return;

        $active.get(0).scrollIntoView({block: 'center', inline: 'center'});
    };

    // Highlight current room with red colour and strip highlighting from all other rooms.
    const highlightPosition = () => {
        let room = location.vnum;
        console.log(">>> highligtPosition", room);
        $(mapElement.current).find('.room').removeClass('active');

        if (room && room !== '') {
            $(mapElement.current).find('.room-' + room).addClass('active');
            recenterPosition();
        }
    };

    const mapFontSizeKey = "map-font-size";

    // Called once on 'componentDidMount'.
    useEffect(() => {
        let cacheFontSize = localStorage.getItem(mapFontSizeKey);
        if (cacheFontSize != null) {
            $(mapElement.current).css('font-size', (cacheFontSize) + 'px');
        }
    }, []);
    
    const changeFontSize = delta => {
        var map = $(mapElement.current);
        var style = map.css('font-size'); 
        var fontSize = parseFloat(style); 
        map.css('font-size', (fontSize + delta) + 'px');
        localStorage.setItem(mapFontSizeKey, fontSize + delta);

        // TODO remember if the room was in view before font change, otherwise don't change position.
        recenterPosition();
    };

    useEffect(() => {
        console.log('>>> useEffect(mapSource)');        
        $(mapElement.current).html(mapSource);
        highlightPosition();
    }, [mapSource]);

    // Called every time a location's room is changed.
    useEffect(() => {
        console.log('>>> useEffect(vnum)', location);
        highlightPosition();
    }, [location.vnum]);

    const appBar = <AppBar className={classes.appbar} color="default">
                       <Toolbar variant="dense">
                          <Typography id="areaName" className={classes.title}>{areaName}</Typography>
                       </Toolbar>
                    </AppBar>;
    
    return <>
            {appBar}
            <MapControls changeFontSize={changeFontSize} />
            <div id="map-wrap">
                <div id="map"><pre ref={mapElement} /></div>
            </div>
          </>;
}
