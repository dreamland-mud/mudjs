import React from 'react';
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import { makeStyles } from "@material-ui/core/styles";
import { Add, Remove } from "@material-ui/icons";
import $ from 'jquery';
import 'arrive';
var lastLocation = require('../location');

const mapFontSizeKey = "map-font-size";

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 500
  }
}));

const MapControls = props => {
    const classes = useStyles();

    const changeFontSize = delta => {
        var map = $('#map');
        var style = map.css('font-size'); 
        var fontSize = parseFloat(style); 
        map.css('font-size', (fontSize + delta) + 'px');
        localStorage.setItem(mapFontSizeKey, fontSize + delta);
    };

    return (
        <div className={classes.root}>
          <ButtonGroup variant="contained" size="small" orientation="vertical" color="primary" aria-label="map resize buttons">
              <Button onClick={() => { changeFontSize(1) }}> <Add /> </Button>
              <Button onClick={() => { changeFontSize(-1) }}> <Remove /> </Button>
          </ButtonGroup>
        </div>
      );
};

export default class Map extends React.Component {
    prevArea = ''

    clearMap() {
        $('#map').html("");
    }

    highlightPosition(currentRoom) {
        $('#map .room').removeClass('active');
        $('#map .room-' + currentRoom).addClass('active');

        var $active = $('#map .room.active');
        if (!$active.length)
            return;

        $active.get(0).scrollIntoView({block: 'center', inline: 'center'});
    }

    initLocationChannel() {
        if('BroadcastChannel' in window) {
            var locationChannel = new BroadcastChannel('location');

            locationChannel.onmessage = e => { 
                if (e.data.what === 'location') { 
                    let currentArea = e.data.location.area;
                    let currentRoom = e.data.location.vnum;

                    if (currentArea && this.prevArea !== currentArea) {
                        this.refreshMap(currentArea, currentRoom);
                        this.prevArea = currentArea;
                    } else {
                        this.highlightPosition(currentRoom);    
                    }
                }
            }
        }
    }

    initMap() {
        this.clearMap();

        if (!lastLocation)
            return;
                
        let loc = lastLocation();
        if (!loc)
            return;

        this.refreshMap(loc.area, loc.vnum);
    }

    initMapFontSize() {
        let cacheFontSize = localStorage.getItem(mapFontSizeKey);
        if (cacheFontSize != null) {
            $('#map').css('font-size', (cacheFontSize) + 'px');
        }
    }

    refreshMap(area, room) {
        let mapName = area.replace(/are$/, 'html');
        let mapUrl = `/maps/sources/${mapName}`;

        $.get(mapUrl)
            .then(data => {
                // TODO reactify
                $('#map').html("<pre>" + data + "</pre>");
                document.arrive('.room-' + room, {onceOnly: true, existing: true}, () => {
                    this.highlightPosition(room);
                });
            }).catch(e => {
                console.log('Map error', e);
                this.clearMap();
            });
    }

    componentDidMount() {
        this.initLocationChannel();
        this.initMap();
        this.initMapFontSize();
    }

    render() {
        return <>
                <MapControls/>
                <div id="map-wrap">
                    <div id="map"></div>
                </div>
              </>;
    }
}
