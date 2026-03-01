import { useState, useEffect } from "react";
import { API_CONFIG } from "@/api/config";

export interface Device {
  id: string;
  name: string;
  os: string;
  version: string;
  lastIp: string;
  isOnline: boolean;
  speedMode: number | null; // online speed in kb/s
  isBlocked: boolean;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchDevices() {
      setIsLoading(true);
      if (API_CONFIG.debug) {
        setTimeout(() => {
          if (!mounted) return;
          setDevices([
            {
              id: "1",
              name: "PC-BOGDAN",
              os: "Windows",
              version: "11",
              lastIp: "192.168.0.24",
              isOnline: true,
              speedMode: 14500,
              isBlocked: false,
            },
            {
              id: "2",
              name: "IPhone 15 Pro",
              os: "iOS",
              version: "17.4",
              lastIp: "10.0.0.12",
              isOnline: false,
              speedMode: null,
              isBlocked: false,
            },
            {
              id: "3",
              name: "Unknown Tablet",
              os: "Android",
              version: "13",
              lastIp: "144.20.12.1",
              isOnline: false,
              speedMode: null,
              isBlocked: true,
            },
          ]);
          setIsLoading(false);
        }, 1000);
        return;
      }

      // real api call here
    }

    fetchDevices();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleBlock = (id: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, isBlocked: !d.isBlocked, isOnline: false, speedMode: null }
          : d,
      ),
    );
  };

  return { devices, isLoading, toggleBlock };
}
