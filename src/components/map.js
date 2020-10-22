import React from 'react';
import Box from '@material-ui/core/Box';
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from "@material-ui/core/styles";
import { Add, Remove } from "@material-ui/icons";
import $ from 'jquery';
import 'arrive';
var lastLocation = require('../location');

const areas = require('../data/areas.json').reduce(function(map, obj) {
    map[obj.file] = obj.name;
    return map;
}, {});

const mapFontSizeKey = "map-font-size";

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

export default class Map extends React.Component {
    AppBar = props => {
        const classes = useStyles();

        return (<AppBar className={classes.appbar} color="default">
                <Toolbar variant="dense">
                    <Typography id="areaName" className={classes.title}></Typography>
                </Toolbar>
            </AppBar>
        );
    };
    
    MapControls = props => {
        let mapComponent = this;
        const classes = useStyles();
    
        const changeFontSize = delta => {
            var map = $('#map');
            var style = map.css('font-size'); 
            var fontSize = parseFloat(style); 
            map.css('font-size', (fontSize + delta) + 'px');
            localStorage.setItem(mapFontSizeKey, fontSize + delta);

            // TODO remember if the room was in view before font change, otherwise don't change position.
            mapComponent.recenterPosition();
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
    
    
    prevArea = ''

    clearMap() {
        $('#map').html("");
        $('#areaName').html("");
    }

    recenterPosition() {
        var $active = $('#map .room.active');
        if (!$active.length)
            return;

        $active.get(0).scrollIntoView({block: 'center', inline: 'center'});
    }

    highlightPosition(currentRoom) {
        $('#map .room').removeClass('active');
        $('#map .room-' + currentRoom).addClass('active');

        this.recenterPosition();
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
        let areaName = areas[area] || '';

        $.get(mapUrl)
            .then(data => {
                // TODO reactify
                $('#map').html("<pre>" + data + "</pre>");
                document.arrive('.room-' + room, {onceOnly: true, existing: true}, () => {
                    this.highlightPosition(room);
                });

                $('#areaName').html(areaName);

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
                <this.AppBar/>
                <this.MapControls/>
                <div id="map-wrap">
                    <div id="map"></div>
                </div>
              </>;
    }
}
