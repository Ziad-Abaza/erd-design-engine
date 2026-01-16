"use client";

import React from 'react';

const MarkerDefinitions = () => {
    return (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
                {/* One marker (|) */}
                <marker
                    id="marker-one"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 5 0 L 5 10" stroke="currentColor" strokeWidth="2" fill="none" />
                </marker>

                {/* Many marker (Crow's Foot) */}
                <marker
                    id="marker-many"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 5 5 L 0 10 M 5 5 L 10 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </marker>

                {/* Optional marker (O) */}
                <marker
                    id="marker-optional"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="white" />
                </marker>

                {/* Identify (solid line) - usually default but we can specify */}

                {/* One and only one (||) */}
                <marker
                    id="marker-one-only"
                    viewBox="0 0 12 10"
                    refX="11"
                    refY="5"
                    markerWidth="8"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 4 0 L 4 10 M 8 0 L 8 10" stroke="currentColor" strokeWidth="2" fill="none" />
                </marker>

                {/* Zero or many (O <) */}
                <marker
                    id="marker-zero-many"
                    viewBox="0 0 15 10"
                    refX="14"
                    refY="5"
                    markerWidth="10"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <circle cx="4" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" fill="white" />
                    <path d="M 8 0 L 15 5 L 8 10 M 15 5 L 15 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </marker>

                {/* One or many (| <) */}
                <marker
                    id="marker-one-many"
                    viewBox="0 0 15 10"
                    refX="14"
                    refY="5"
                    markerWidth="10"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 4 0 L 4 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <path d="M 8 0 L 15 5 L 8 10 M 15 5 L 15 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </marker>
            </defs>
        </svg>
    );
};

export default MarkerDefinitions;
