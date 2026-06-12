// hooks/usePhotos.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Event } from "@/components/gallery/EventSelector";
import { FilterValues } from "@/components/gallery/FilterBar";

export interface UsePhotosOptions {
  /** Initial filter values */
  defaultFilters?: FilterValues;
  /** Number of items per page (default 30) */
  pageSize?: number;
  /** If true, use face search API instead of browse API (my-photos mode) */
  faceSearchMode?: boolean;
  /** Session user (needed for face search mode to check faceEnrolled) */
  user?: { faceEnrolled?: boolean } | null;
}

export interface UsePhotosReturn {
  // Photo data
  photos: any[];
  setPhotos: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;

  // Season & event
  selectedSeason: any;
  setSelectedSeason: React.Dispatch<React.SetStateAction<any>>;
  selectedEvent: string | null;
  setSelectedEvent: React.Dispatch<React.SetStateAction<string | null>>;
  selectedTimeslot: string | null;
  setSelectedTimeslot: React.Dispatch<React.SetStateAction<string | null>>;
  eventsList: Event[];
  seasonLoading: boolean;
  setSeasonLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Filters
  filters: FilterValues;
  setFilters: React.Dispatch<React.SetStateAction<FilterValues>>;

  // Face search overlay (gallery page only)
  faceSearchResults: any[] | null;
  setFaceSearchResults: React.Dispatch<React.SetStateAction<any[] | null>>;
  faceSearchLoading: boolean;
  setFaceSearchLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions — stable references via useCallback
  handleLoadMore: () => void;
  fetchPhotos: (pageNum: number, currentFilters: FilterValues, isAppend?: boolean) => Promise<void>;
  fetchMyPhotos: () => Promise<void>;
}

export function usePhotos(options: UsePhotosOptions = {}): UsePhotosReturn {
  const {
    defaultFilters = { sortBy: "newest", status: "approved" },
    pageSize = 30,
    faceSearchMode = false,
    user = null,
  } = options;

  // Photo states
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cursor for cursor-based pagination
  const cursorRef = useRef<string | null>(null);

  // Face search states (gallery overlay mode)
  const [faceSearchResults, setFaceSearchResults] = useState<any[] | null>(null);
  const [faceSearchLoading, setFaceSearchLoading] = useState(false);

  // Season and event states
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedTimeslot, setSelectedTimeslot] = useState<string | null>(null);
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(true);

  // Filter states
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);

  // Ref to prevent duplicate in-flight requests
  const loadingRef = useRef(false);

  // ── Load Season & Events ─────────────────────────────────────────
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const url = selectedSeason?.id
          ? `/api/events?seasonId=${selectedSeason.id}`
          : "/api/events";
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setSelectedSeason(data.season);
          setEventsList(data.events || []);
          if (selectedSeason?.id && selectedEvent) {
            setSelectedEvent(null);
          }
        }
      } catch (err) {
        console.error("Error loading events:", err);
      } finally {
        setSeasonLoading(false);
      }
    };
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason?.id]);

  // ── Gallery browse fetch (cursor-based) ─────────────────────────
  const fetchPhotos = useCallback(
    async (pageNum: number, currentFilters: FilterValues, isAppend = false) => {
      if (faceSearchResults !== null) return;
      if (loadingRef.current) return;

      setLoading(true);
      loadingRef.current = true;
      setError(null);

      try {
        const queryParams: Record<string, string> = {
          limit: pageSize.toString(),
          status: currentFilters.status || "approved",
        };

        // Use cursor for appending, page for reset
        if (isAppend && cursorRef.current) {
          queryParams.cursor = cursorRef.current;
        } else {
          queryParams.page = pageNum.toString();
          cursorRef.current = null; // reset cursor on fresh fetch
        }

        if (selectedEvent) {
          queryParams.eventId = selectedEvent;
        } else if (selectedSeason?.id) {
          queryParams.seasonId = selectedSeason.id;
        }

        if (selectedTimeslot) {
          queryParams.timeslot = selectedTimeslot;
        }

        const query = new URLSearchParams(queryParams);
        const res = await fetch(`/api/photos?${query.toString()}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();

        if (data.success) {
          let list: any[] = data.photos;
          if (currentFilters.sortBy === "oldest") {
            list = [...list].reverse();
          }

          setPhotos((prev) => (isAppend ? [...prev, ...list] : list));

          // Store next cursor for subsequent load-more calls
          cursorRef.current = data.nextCursor ?? null;

          // hasMore from API (cursor-based) or calculate from page info
          const moreAvailable =
            data.hasMore !== undefined
              ? data.hasMore
              : data.page < data.totalPages;
          setHasMore(moreAvailable);
        } else {
          throw new Error(data.error || "Failed to fetch photos");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Error fetching photos:", msg);
        setError("ไม่สามารถดึงข้อมูลรูปภาพได้ กรุณาลองใหม่อีกครั้ง");
        setHasMore(false);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [faceSearchResults, selectedEvent, selectedSeason?.id, selectedTimeslot, pageSize]
  );

  // ── My-photos face-search fetch ───────────────────────────────────
  const fetchMyPhotos = useCallback(async () => {
    if (!user?.faceEnrolled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const searchBody: Record<string, unknown> = { limit: 100 };

      if (selectedEvent) {
        searchBody.eventId = selectedEvent;
      } else if (selectedSeason?.id) {
        searchBody.seasonId = selectedSeason.id;
      }

      if (selectedTimeslot) {
        searchBody.timeslot = selectedTimeslot;
      }

      const res = await fetch("/api/face/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos(data.photos || []);
      } else {
        setError(data.error || "เกิดข้อผิดพลาดในการโหลดรูปภาพของท่าน");
      }
    } catch (err) {
      console.error(err);
      setError("ไม่สามารถเชื่อมต่อระบบค้นหาใบหน้าได้ในขณะนี้");
    } finally {
      setLoading(false);
    }
  }, [user?.faceEnrolled, selectedEvent, selectedSeason?.id, selectedTimeslot]);

  // ── Stable handleLoadMore (no re-subscribe Observer) ─────────────
  const handleLoadMore = useCallback(() => {
    if (loadingRef.current || !hasMore || faceSearchResults !== null) return;
    setPage((prev) => {
      const nextPage = prev + 1;
      fetchPhotos(nextPage, filters, true);
      return nextPage;
    });
  }, [hasMore, faceSearchResults, fetchPhotos, filters]);

  // Reload photos when filters/season/event/timeslot changes
  useEffect(() => {
    if (seasonLoading) return;

    if (faceSearchMode) {
      fetchMyPhotos();
    } else {
      setPage(1);
      cursorRef.current = null;
      fetchPhotos(1, filters, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, faceSearchResults, selectedEvent, selectedTimeslot, selectedSeason, seasonLoading]);

  return {
    photos,
    setPhotos,
    loading,
    error,
    hasMore,
    page,

    selectedSeason,
    setSelectedSeason,
    selectedEvent,
    setSelectedEvent,
    selectedTimeslot,
    setSelectedTimeslot,
    eventsList,
    seasonLoading,
    setSeasonLoading,

    filters,
    setFilters,

    faceSearchResults,
    setFaceSearchResults,
    faceSearchLoading,
    setFaceSearchLoading,

    handleLoadMore,
    fetchPhotos,
    fetchMyPhotos,
  };
}
