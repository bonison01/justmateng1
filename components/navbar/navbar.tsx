"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowRight, LogOut, BadgeCheck, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/lib/cart/store";
import Image from "next/image";
import { Separator } from "../ui/separator";
import { clearCart } from "@/lib/cart/cartSlice";
import { clearUser } from "@/lib/cart/userSlice";
import { CardDescription } from "../ui/card";
import styles from "./navbar.module.css";

type NavLink =
    | { name: string; href: string; children?: undefined }
    | { name: string; href?: undefined; children: { name: string; href: string }[] };

function Navbar() {
    const [isNavOpen, setNavOpen] = useState<boolean>(false);
    const [isSearchOpen, setSearchOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useDispatch();
    const user = useSelector((state: RootState) => state.user.user);

    const toggleNav = () => setNavOpen((prev) => !prev);
    const closedNav = () => setNavOpen(false);

    const openSearch = () => {
        setSearchOpen(true);
        setNavOpen(false);
    };
    const closeSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };

    const submitSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        router.push(`/events?search=${encodeURIComponent(q)}`);
        closeSearch();
    };

    useEffect(() => {
        if (isSearchOpen) searchInputRef.current?.focus();
    }, [isSearchOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        dispatch(clearCart());
        dispatch(clearUser());
        setNavOpen(false);
        router.push("/login");
    };

    const links: NavLink[] = [
        { name: "Discover Businesses", href: "https://www.instagram.com/mateng.discovery/" },
        { name: "Delivery Service", href: "https://matengdelivery.com/" },
        { name: "Events", href: "/events" },
    ];

    const SearchButton = ({ className = "" }: { className?: string }) => (
        <button
            onClick={openSearch}
            aria-label="Search"
            className={`w-9 h-9 flex items-center justify-center rounded-full text-white/80 border border-gray-400/50 bg-white/5 hover:bg-white/10 hover:text-white transition ${className}`}
        >
            <Search size={16} />
        </button>
    );

    const UserGreeting = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative min-w-30 h-9 p-0 pr-4 border border-gray-400/50 rounded-full text-white/70 shadow-inner bg-[radial-gradient(ellipse_at_bottom,_rgba(71,81,92,1)_0%,_rgba(11,21,30,1)_45%)] hover:scale-105 hover:text-white flex items-center gap-1">
                    <Image
                        src={user?.profile_pic || "/user.png"}
                        alt="user"
                        width={100}
                        height={100}
                        className="w-9 h-9 rounded-full object-cover"
                    />
                    Hi, {user?.name?.split(" ")[0] || "User"}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="bg-[#1a1a1a] text-white border border-gray-500/30 shadow-lg rounded-lg p-2 min-w-[150px] z-[99999]"
            >
                <DropdownMenuItem
                    className="hover:text-white cursor-pointer px-3 py-2"
                    onClick={() => { router.push("/profile"); closedNav(); }}
                >
                    <BadgeCheck /> Account Details
                </DropdownMenuItem>
                <Separator className="bg-gray-500/40" />
                <DropdownMenuItem
                    className="hover:text-white cursor-pointer px-3 py-2"
                    onClick={handleLogout}
                >
                    <LogOut /> Log Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const LoginDropdown = () => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <button className="cartBtn rounded-full p-0.5">
                <span className="rounded-full py-2 px-6 flex items-center">
                    Login
                    <ArrowRight size={18} className="text-white ml-1" />
                </span>
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="end"
            className="bg-[#1a1a1a] text-white border border-gray-500/30 shadow-lg rounded-lg p-2 min-w-[180px] z-[99999]"
        >
            <DropdownMenuItem
                className="hover:text-white cursor-pointer px-3 py-2"
                onClick={() => {
                    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
                    closedNav();
                }}
            >
                👤 User Login
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:text-white cursor-pointer px-3 py-2"
                onClick={() => { window.open("https://matengdelivery.com/", "_blank"); closedNav(); }}
            >
                🏢 Business Login
            </DropdownMenuItem>
            <DropdownMenuItem
                className="hover:text-white cursor-pointer px-3 py-2"
                onClick={() => { router.push("/admin"); closedNav(); }}
            >
                🛡️ Admin Login
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

    return (
        <div className="w-full fixed top-0 z-[10000] sm:px-4 bg-gradient-to-r from-[#131316d9] via-[#222226a6] to-[#131316d9] backdrop-blur-sm">

            {/* SEARCH OVERLAY BAR — replaces the nav row while open, same spot on desktop & mobile */}
            {isSearchOpen && (
                <form
                    onSubmit={submitSearch}
                    className="h-16 flex items-center gap-3 px-4"
                >
                    <Search size={18} className="text-white/50 flex-shrink-0" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search events, artists, venues, businesses…"
                        className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
                    />
                    <button
                        type="submit"
                        className="hidden sm:inline-flex px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
                    >
                        Search
                    </button>
                    <button
                        type="button"
                        onClick={closeSearch}
                        aria-label="Close search"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition flex-shrink-0"
                    >
                        <X size={18} />
                    </button>
                </form>
            )}

            {/* DESKTOP NAV */}
            <div className={`hidden lg:flex justify-between items-center h-16 px-4 ${isSearchOpen ? "!hidden" : ""}`}>
                <Link href="/home">
                    <div className="h-16 flex items-center p-2 pl-0">
                        <img src="/logo.png" alt="logo" className="h-full object-contain" />
                    </div>
                </Link>

                <div className="flex gap-4 items-center text-white/80 text-sm font-medium">
                    {links.map((link) =>
                        link.children ? (
                            <DropdownMenu key={link.name}>
                                <DropdownMenuTrigger asChild>
                                    <button className="px-3 py-1.5 rounded-full hover:bg-white/10 text-white/80">
                                        {link.name}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-[#1a1a1a] text-white rounded-md shadow-md min-w-[160px] border border-gray-600/30 z-[99999]">
                                    {link.children.map((child) => (
                                        <DropdownMenuItem
                                            key={child.href}
                                            className="hover:bg-white/10 cursor-pointer"
                                            onClick={() => router.push(child.href)}
                                        >
                                            {child.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-3 py-1.5 rounded-full hover:bg-white/10 transition ${
                                    pathname === link.href ? "bg-white/10 text-white" : ""
                                }`}
                            >
                                {link.name}
                            </Link>
                        )
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <SearchButton />
                    {user ? <UserGreeting /> : <LoginDropdown />}
                </div>
            </div>

            {/* MOBILE TOP BAR */}
            <div className={`lg:hidden h-16 flex justify-between items-center px-4 ${isSearchOpen ? "!hidden" : ""}`}>
                <Link href="/home">
                    <img src="/logo.png" alt="logo" className="w-32" />
                </Link>

                <div className="flex items-center gap-2">
                    <SearchButton />

                    {/* Hamburger */}
                    <button
                        onClick={toggleNav}
                        className="flex flex-col justify-center gap-[5px] w-8 h-8 p-1"
                        aria-label="Toggle menu"
                    >
                        <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${isNavOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
                        <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${isNavOpen ? "opacity-0" : ""}`} />
                        <span className={`block h-0.5 bg-white rounded transition-all duration-300 ${isNavOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
                    </button>
                </div>
            </div>

            {/* MOBILE NAV MENU */}
            <nav className={`${styles.navMenu} ${isNavOpen ? styles.open : ""}`}>
                <div className="flex flex-col items-center mt-2">
                    {links.map((link) =>
                        link.children ? null : (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={styles.navlink}
                                onClick={closedNav}
                            >
                                {link.name}
                            </Link>
                        )
                    )}
                    <div className="mt-6">{user ? <UserGreeting /> : <LoginDropdown />}</div>
                </div>

                {/* Mobile CTA */}
                <div className="mt-8 p-4 text-center">
                    <CardDescription className="text-sm mb-3 text-gray-400">
                        Cargo service inquiries
                    </CardDescription>
                    <a href="tel:+919774795905">
                        <button className="px-6 py-3 text-white bg-green-900/60 rounded-full shadow-md">
                            📦 Cargo Service
                        </button>
                    </a>
                </div>
            </nav>
        </div>
    );
}

export default Navbar;