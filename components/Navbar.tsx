"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "./Logo";
import { useState, useEffect } from "react";

export default function Navbar() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);

    // Handle scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Hide navbar on auth pages and slide page (immersive mode)
    const isAuthPage = pathname?.startsWith("/auth");
    const isSlidePage = pathname?.includes("/slide");

    if (isAuthPage || isSlidePage) return null;

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? "py-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20"
                : "py-5 bg-transparent"
                }`}
        >
            <div className="container-default flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Logo size="md" />

                    {/* Desktop Nav Links */}
                    {status === "authenticated" && (
                        <div className="hidden md:flex items-center">
                            <Link
                                href="/plans"
                                className={`text-base font-medium transition-colors duration-200 ${pathname === "/plans"
                                    ? "text-sky-400"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                My Plans
                            </Link>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {status === "loading" ? (
                        <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
                    ) : status === "authenticated" ? (
                        <>
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <span className="text-sm font-medium text-slate-200 leading-none">
                                    {session.user?.name || "User"}
                                </span>
                                <span className="text-xs text-slate-500 mt-1">
                                    {session.user?.email}
                                </span>
                            </div>

                            <Link href="/profile" className="relative group">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:border-sky-500/50 group-hover:text-sky-400 transition-all shadow-md">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            </Link>
                        </>
                    ) : (
                        !isAuthPage && (
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/auth/login"
                                    className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="btn btn-primary text-sm px-5 py-2 rounded-full"
                                >
                                    Get Started
                                </Link>
                            </div>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
}
