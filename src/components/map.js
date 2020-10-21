import React from 'react';
import $ from 'jquery';
import 'arrive';
var lastLocation = require('../location');

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
    }

    render() {
        return <div id="map-wrap">
                    <div id="map"></div>
                </div>;
    }
}
