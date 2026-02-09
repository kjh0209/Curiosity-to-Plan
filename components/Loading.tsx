"use client";

import React from "react";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative w-16 h-16">
                {/* Outer Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-700/50"></div>

                {/* Spinning Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 border-r-purple-500 animate-spin"></div>

                {/* Inner Pulse */}
                <div className="absolute inset-4 rounded-full bg-slate-800 animate-pulse flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/50"></div>
                </div>
            </div>
            <p className="text-slate-400 text-sm font-medium animate-pulse">Loading...</p>
        </div>
    );
}
