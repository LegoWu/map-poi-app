import React, { useState, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from "@react-google-maps/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import chartRawData from './data/chartData.json'

const containerStyle = {
  width: "100%",
  height: "100vh"
};

const defaultCenter = {
  lat: 25.059633, lng: 121.54398
};

// Haversine formula to calculate distance between two coordinates
const getDistanceInKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function App() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  });

  const [markers, setMarkers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [searchCenter, setSearchCenter] = useState(defaultCenter);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [chartType, setChartType] = useState("bar");
  const [circleCenter, setCircleCenter] = useState(defaultCenter);
  const mapRef = useRef(null)

  // Fetch POI dataset from API when component mounts
  const fetchPOIs = async () => {
    try {
      const response = await fetch("https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json");
      const data = await response.json();
      const loadedMarkers = data.map((item) => ({
        id: item.sno,
        name: item.sna,
        position: {
          lat: item.latitude,
          lng: item.longitude
        },
        address: item.ar, 
        total: item.total, 
        available: item.available_rent_bikes
      }));
      setMarkers(loadedMarkers);
    } catch (error) {
      console.error("Failed to fetch POIs:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const chartData = chartRawData.result.results?.map(row => ({
          label: row.民國年月,
          value: Number(row["臺北市youbike每月使用量（次數）"])
        }));

      setStats({ chartData });
    } catch (error) {
      console.error("Failed to fetch or parse stats:", error);
    }
  };

  useEffect(() => {
    fetchPOIs();
    fetchStats();
  }, []);

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setMapCenter({ lat, lng });
    setSearchCenter({ lat, lng });
    setCircleCenter({ lat, lng });
  };

  const handleSearchCenterChange = (e) => {
    setSearchCenter((prev) => ({ ...prev, [e.target.name]: parseFloat(e.target.value) }));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (value.trim() === "") {
      setSuggestions([]);
    } else {
      const matches = markers.filter((m) =>
        m.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 5)); // limit to 5 suggestions
    }
  };

  const handleSuggestionClick = (name) => {
    setSearch(name);
    setSuggestions([]);
  };

  const filteredMarkers = markers.filter((m) => {
    const distance = getDistanceInKm(
      searchCenter.lat,
      searchCenter.lng,
      m.position.lat,
      m.position.lng
    );
    return (
      m.name.toLowerCase().includes(search.toLowerCase()) && m.available > 0 && distance <= 3
    );
  });

  const nonFilteredMarkers = markers.filter((m) => {
    const distance = getDistanceInKm(
      searchCenter.lat,
      searchCenter.lng,
      m.position.lat,
      m.position.lng
    );
    return (
      distance > 3
    );
  });

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-1/4 overflow-y-auto p-4 border-r space-y-2 h-full">
          <h1>UBike Map!</h1>
          <div className="relative">
            <input
              className="border p-2 rounded w-full"
              placeholder="Search POIs by name..."
              value={search}
              onChange={handleSearchChange}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setSuggestions([]);
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black"
              >
                ✕
              </button>
            )}
            {suggestions.length > 0 && (
              <ul className="absolute bg-white border w-full z-10 shadow-lg">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSuggestionClick(s.name)}
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.0001"
              className="border p-2 rounded w-1/2"
              name="lat"
              value={searchCenter.lat}
              onChange={handleSearchCenterChange}
              placeholder="Search center lat"
            />
            <input
              type="number"
              step="0.0001"
              className="border p-2 rounded w-1/2"
              name="lng"
              value={searchCenter.lng}
              onChange={handleSearchCenterChange}
              placeholder="Search center lng"
            />
          </div>
          <ul className="pt-4 space-y-1">
            {filteredMarkers.map((m) => (
              <li
                key={m.id}
                className="cursor-pointer hover:underline"
                onClick={() => {
                  setSelected(m);
                  mapRef.current?.panTo(m.position);
                }}
              >
                <img className="inline" alt="" src='http://maps.google.com/mapfiles/ms/icons/blue-dot.png'/>
                <span className="inline">{m.name}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Map container */}
        <div className="w-3/4 h-full">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={13}
            onClick={handleMapClick}
            onLoad={(map) => (mapRef.current = map)}
          >
            {filteredMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.position}
                onClick={() => setSelected(marker)}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // or your custom icon URL
                  scaledSize: new window.google.maps.Size(32, 32) // adjust size if needed
                }}
              />
            ))}
            {nonFilteredMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.position}
                onClick={() => setSelected(marker)}
              />
            ))}
            {selected && (
              <InfoWindow
                position={selected.position}
                onCloseClick={() => setSelected(null)}
              >
                <div>
                <h2>{selected.name}</h2>
                <div>地址: {selected.address}</div>
                <div>總共數量: {selected.total}</div>
                <div>可借數量: {selected.available}</div>
                </div>
              </InfoWindow>
            )}
            {/* {circleCenter && (
              <Circle
                center={circleCenter}
                radius={3000}
                options={{
                  strokeColor: "#FF0000",
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  fillColor: "#FF0000",
                  fillOpacity: 0.1
                }}
              />
            )} */}
          </GoogleMap>
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={fetchPOIs}
              className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
            >
              Refresh POIs
            </button>
            <button
              onClick={() => {
                setSelected(null);
                setMapCenter(defaultCenter);
                setSearchCenter(defaultCenter);
                setCircleCenter(null);
              }}
              className="ml-2 bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
            >
              Reset Center
            </button>
          </div>
        </div>
      </div>

      {/* Bottom stats panel */}
      <div className="w-full p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold">Statistics</div>
          <div>
            <button
              onClick={() => setChartType("bar")}
              className={`mr-2 px-3 py-1 rounded border ${chartType === "bar" ? "bg-blue-500 text-white" : "bg-white"}`}
            >
              Bar Chart
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`px-3 py-1 rounded border ${chartType === "line" ? "bg-blue-500 text-white" : "bg-white"}`}
            >
              Line Chart
            </button>
          </div>
        </div>
        {stats && stats.chartData ? (
          <ResponsiveContainer width="100%" height={300}>
            {chartType === "bar" ? (
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            ) : (
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div>Loading stats...</div>
        )}
      </div>
    </div>
  );
}
