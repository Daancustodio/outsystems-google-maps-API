/**
 * Class that encapsulates all created Google Maps objects and abstracts
 * some of the events triggered
 */
function OSGoogleMapsAPIObject() {
    var self = this;
    var initQueue = [];
    var documentLoaded = false;
    var geocoder;
    var directionsService;
    this.OSMaps = {};

    // Additional classes

    /**
     * Generic exception thrown by this library.
     */
    function OSException(name, message) {
        this.name = name;
        this.message = message;
    }

    /**
     * This Defines the OSMap class and its constructor, which encapsulates a Google Map,
     * its identifier and other items.
     */
    function OSMap(mapId, gMap) {
        this.mapId = mapId;
        this.gMap = gMap; // Google Map object
        this.callbacks = []; // Functions to be called on map creation
        this.markers = {}; // OSMarkers on this object
        this.directions = {}; // Google Maps directions renderers from this map

        /**
         * Adds a callback to be executed when the map associated with the the mapId is created.
         * The call back gets called with one parameter: the map associated with 'mapId'.
         */
        this.executeOnLoad = function(mapId, callback) {
            if (this.gMap != null) {
                callback(this);
            } else {
                this.callbacks.push(callback);
            }
        };

        // Returns a marker on this map (if no entry exists, an empty one 
        // will be created for callbacks)
        this.getMarker = function(markerId) {
            // See if the marker was already initialized, and if not, create null marker
            // to accumulate subsequent event callbacks
            if (typeof this.markers[markerId] === 'undefined') {
                //this.markers[markerId] = new OSMarker(markerId, null);
                //return this.markers[markerId];
                throw new OSException('NoMarker',
                    'Marker with identifier \'' + markerId + '\', under map \'' + mapId + '\', has not yet been created.');
            } else {
                return this.markers[markerId];
            }
        }

        // Creates a marker stub, if none with its identifier already exist
        this.createStub = function(markerId) {
            // See if the marker was already initialized, and if not, create null marker
            // to accumulate subsequent event callbacks
            if (typeof this.markers[markerId] === 'undefined') {
                this.markers[markerId] = new OSMarker(markerId, null);
            } else if (typeof this.markers[markerId].gMap === google.maps.Marker) {
                throw new OSException('MarkerAlreadyExists', 'A Marker with identifier \'' + markerId + '\' already exists.');
            } else {
                self.logMessage('A marker stub creation was attempted on an already created stub.');
            }
        }
    };

    /**
     * This Defines the OSMarker class and its constructor, which encapsulates a Google
     * Maps Marker, its own identifier and other items.
     */
    function OSMarker(markerId, gMarker) {
        this.markerId = markerId;
        this.gMarker = gMarker; // Google Map object
        this.callbacks = []; // Functions to be called on map creation

        // Adds a callback, if gMarker is not initialized; will 
        // run it immediately otherwise
        this.executeOnLoad = function(callback) {
            // If the marker is already created...
            if (this.gMarker != null) {
                // We can execute it right away
                callback(this);
            } else {
                // ...or else we'll queue it
                this.callbacks.push(callback);
            }
        }
    };

    // Methods

    /**
     *  Returns a given map, if it exists, throwing an exception otherwise.
     */
    this.getMap = function(mapId) {
        if (typeof self.OSMaps[mapId] === 'undefined')
            throw new OSException('NoMap', 'Map with identifier \'' + mapId + '\' has not yet been created.');
        else
            return self.OSMaps[mapId];
    }

    function getGeocoder() {
        if (!geocoder) {
            geocoder = new google.maps.Geocoder();
        }
        return geocoder;
    }

    function getNewDirectionsService() {
        // You NEED to create a new service everytime you need a new renderer
        directionsService = new google.maps.DirectionsService();

        return directionsService;
    }

    /**
     * Creates a new osMap object saves it in the list of osMaps
     */
    function newMap(mapId, containerId, newMap) {
        self.OSMaps[mapId] = new OSMap(mapId, newMap);

        return self.OSMaps[mapId];
    };

    /**
     * Set the queue to render on load
     */
    google.maps.event.addDomListener(window, 'load', function() {
        documentLoaded = true;
        for (var i = 0; i < initQueue.length; i++) {
            var containerId = initQueue[i].containerId;
            var containerEl = document.getElementById(containerId);
            var mapId = initQueue[i].mapId;

            self.OSMaps[mapId].gMap = new google.maps.Map(containerEl, initQueue[i].mapOptions);

            var callbacks = self.OSMaps[mapId].callbacks;
            for (var j = 0; j < callbacks.length; j++) {
                callbacks[j](self.OSMaps[mapId]);
            }
        }
    });

    // Function that creates the maps
    this.create = function(mapId, containerId, zoom, center, mapOptions) {
        var containerEl = document.getElementById(containerId);
        var mapOptionsRequired = {
            zoom: parseInt(zoom) || 8,
            center: center
        };
        var opts = jQuery.extend(true, {}, mapOptionsRequired, mapOptions);

        if (documentLoaded) {
            var map = new google.maps.Map(containerEl, opts);
            return newMap(mapId, containerId, map);
        } else {
            initQueue.push({
                mapId: mapId,
                containerId: containerId,
                mapOptions: opts
            });
            return newMap(mapId, containerId, null);
        }
    };

    /**
     * Adds a callback to be executed when the map associated with the the mapId is created.
     * The call back gets called with one parameter: the map associated with 'mapId'.
     */
    this.executeOnLoad = function(mapId, callback) {
        if (this.OSMaps[mapId].gMap != null) {
            callback(this.OSMaps[mapId]);
        } else {
            this.OSMaps[mapId].callbacks.push(callback);
        }
    };

    /**
     * Performs a GeoCode request, giving a callback to be executed once it is done.
     */
    this.geocode = function(address, callback) {
        var geocoder = getGeocoder();
        geocoder.geocode({
            address: address
        }, callback);
    };

    /**
     * Performs a GeoCode request, giving a callback to be executed once it is done.
     */
    this.invertedGeocode = function(latLng, callback) {
        var geocoder = getGeocoder();
        geocoder.geocode({
            location: latLng
        }, callback);
    };

    /**
     * Add a marker to the map associated with the mapId
     *
     * markerId - An identifier to identify the marker, if needed
     */
    this.addMarker = function(mapId, markerId, markerOptions) {
        //Check if the marker was already added previously
        try {
            if (typeof this.getMap(mapId).getMarker(markerId).gMarker === google.maps.Marker)
                self.logMessage('Marker \'' + markerId + '\' was already added previously.');
        } catch (e) {
            if (e instanceof OSException) {
                if (e.name == 'NoMap') {
                    self.logMessage('OSGoogleMapsAPI: Tried adding a Marker to an unexisting map.');
                    throw e;
                } else if (e.name == 'NoMarker') {
                    // Marker does not exist, as expected
                } else
                    throw e;
            } else
                throw e;
        }

        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
                OSMap.gMap.setCenter(markerOptions.position);
                markerOptions.map = OSMap.gMap;

                // Create the Google Maps object and OSMarker object
                var gMarker = new google.maps.Marker(markerOptions);
                var newOSMarker = new OSMarker(markerId, gMarker);

                try {
                    // Execute pending callbacks on the new OSMarker (if applicable)
                    var callbacks = OSMap.getMarker(markerId).callbacks;
                    for (var j = 0; j < callbacks.length; j++) {
                        callbacks[j](newOSMarker);
                    }
                } catch (e) {
                    if (e instanceof OSException) {
                        if (e.name == 'NoMarker') {
                            // No callbacks to be ran
                        } else
                            throw e;
                    } else
                        throw e;
                }
            // Assign the news OSMarker to the respective OSMap position
            OSMap.markers[markerId] = newOSMarker;
        });
    };

    /**
     * Utility to remove a marker from a Google Map.
     *
     * markerId - identifier associated with the marker to be removed.
     */
    this.removeMarker = function(mapId, markerId) {
        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
            var OSMarker = OSMap.markers[markerId];
            var gMarker = OSMarker.gMarker;
            gMarker.setMap(null);
            delete OSMap.markers[markerId];
        });
    };



    /**
     * Utility to add an event to a map
     *
     * mapId - the identifier for the map
     * eventName - the name of the event that will be listened to on this map
     * handler - a function that will be called and passed in a OSMap object
     */
    this.addMapEvent = function(mapId, eventName, handler) {
        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
            google.maps.event.addListener(OSMap.gMap, eventName, handler);
        });
    }

    /**
     * Utility to add an event to a marker
     *
     * mapId - the of the map for this marker
     * markerId - the identifier of the marker that the event will be added to
     * eventName - the name of the event that will be listen to on this marker
     * handler - a function that will be called and passed in a OSMap object
     */
    this.addMarkerEvent = function(mapId, markerId, eventName, handler) {
        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
            // Gets an existing OSMarker or a stub (to add callbacks)
            var curOSMarker;
            try {
                curOSMarker = OSMap.getMarker(markerId);
            } catch(e){
                if (e instanceof OSException) {
                    if (e.name == 'NoMarker') {
                        // No marker stub exists, so create it
                        OSMap.createStub(markerId);
                        curOSMarker = OSMap.getMarker(markerId);
                    } else
                        throw e;
                } else
                    throw e;
            }

            // Add defferred event callback
            curOSMarker.executeOnLoad(function(OSMarker) {
                google.maps.event.addListener(OSMarker.gMarker, eventName, handler);
            });
        });
    }

    /**
     * Utility to add a set of rendered directions to a map
     *
     * mapId - the identifier of the map where to add these directions
     * directionsId - the identifier of the directions renderer will be added to the map
     * directionsRequestOptions - JSON object containing the request options for the directions to be obtained
     * onCreateCallback - an optional callback function that will be called once the directions are ready
     */
    this.addDirections = function(mapId, directionsId, directionsRequestOptions, onCreateCallback) {
        onCreateCallback = (typeof onCreateCallback === 'undefined') ? null : onCreateCallback;
        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
            // Ask for the route and set it on the created directions renderer
            var directionsService = getNewDirectionsService();
            directionsService.route(directionsRequestOptions, function(response, status) {
                // Create a directions renderer and add to the array
                // NOTE: This needs to be here in order to support
                //       multiple directions
                newRenderer = new google.maps.DirectionsRenderer();
                newRenderer.setMap(OSMap.gMap);
                OSMap.directions[directionsId] = newRenderer;

                // If a proper response is received, render the directions
                if (status == google.maps.DirectionsStatus.OK) {
                    newRenderer.setDirections(response);

                    if (onCreateCallback != null) {
                        onCreateCallback();
                    }
                } else {
                    self.logMessage('Directions request failed with status "'+status+'".');
                }
            });
        });
    }


    /**
     * Utility to remove a directions object from a given map
     * mapId - the identifier of the map with directions
     * directionsId - the identifier of the directions renderer that will be removed
     */
    this.removeDirections = function(mapId, directionsId) {
        this.getMap(mapId).executeOnLoad(mapId, function(OSMap) {
            var directions = OSMap.directions[directionsId];
            directions.setMap(null);
            delete OSMap.directions[directionsId];
        });
    }

    /**
     * Utility to compute the duration of a given set of directions.
     *
     * mapId - the identifier of the map these directions were added to
     * directionsId - the identifier of the directions renderer that the event will be added to
     */
    this.getDirectionsDuration = function(mapId, directionsId) {
        var direction = self.OSMaps[mapId].directions[directionsId].getDirections();
        var duration = 0;
        if (direction.routes && direction.routes.length > 0) {
            var route = direction.routes[0];
            if (route.legs && route.legs.length > 0) {
                var legs = route.legs;
                for (var i = 0; i < legs.length; i++) {
                    if (legs[i].duration.value) {
                        duration += legs[i].duration.value;
                    }
                }
            }
        }
        return duration;
    }

    /**
     * Utility to log a message to console, with a predefined format.
     * message - the message to be displayed on the console.
     */
    this.logMessage = function(message){
        var logPrefix = "OSGoogleMapsAPI"

        console.log(logPrefix + ": " + message);
    }
}