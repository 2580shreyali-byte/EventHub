import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../../api/client.js';
import { 
  ScanLine, 
  Camera, 
  DoorOpen, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  Clock
} from 'lucide-react';

export function GateScannerPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [gates, setGates] = useState([]);
  const [selectedGateId, setSelectedGateId] = useState('');

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualPayload, setManualPayload] = useState('');

  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { status: 'APPROVED' | 'REJECTED', data, error }

  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'eventhub-qr-reader';

  // Load published events
  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await api.get('/events?limit=50');
        if (res.data?.success) {
          const evts = res.data.data.events || [];
          setEvents(evts);
          if (evts.length > 0) {
            setSelectedEventId(String(evts[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load events for scanner:', err);
      }
    }
    loadEvents();
  }, []);

  // When event changes, load gates
  useEffect(() => {
    if (!selectedEventId) return;

    async function loadGates() {
      try {
        const res = await api.get(`/events/${selectedEventId}/gates`);
        if (res.data?.success) {
          const gList = res.data.data || [];
          setGates(gList);
          const activeGates = gList.filter(g => g.isActive !== false);
          if (activeGates.length > 0) {
            setSelectedGateId(String(activeGates[0].id));
          } else if (gList.length > 0) {
            setSelectedGateId(String(gList[0].id));
          } else {
            setSelectedGateId('');
          }
        }
      } catch {
        setGates([]);
        setSelectedGateId('');
      }
    }
    loadGates();
  }, [selectedEventId]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async () => {
    setCameraError('');
    try {
      if (html5QrCodeRef.current) {
        await stopCameraScanner();
      }

      const qrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = qrCode;

      await qrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanPayload(decodedText);
        },
        () => {
          // Ignore frame decode misses
        }
      );

      setScanning(true);
    } catch (err) {
      setCameraError(err.message || 'Camera permission denied or camera device unavailable.');
      setScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch {
        // Ignore stop error
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const handleScanPayload = async (payload) => {
    if (processing) return; // Prevent double trigger
    setProcessing(true);

    const scanUuid = crypto.randomUUID();

    try {
      const res = await api.post('/checkin/scan', {
        eventId: Number(selectedEventId),
        gateId: Number(selectedGateId),
        scanUuid,
        qrPayload: payload.trim()
      });

      if (res.data?.success) {
        setScanResult({
          status: 'APPROVED',
          data: res.data.data,
          rawPayload: payload
        });
      }
    } catch (err) {
      setScanResult({
        status: 'REJECTED',
        error: {
          code: err.code || 'SCAN_ERROR',
          message: err.message || 'Check-in validation failed.'
        },
        rawPayload: payload
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualPayload.trim()) return;
    handleScanPayload(manualPayload.trim());
  };

  const resetForNextAttendee = () => {
    setScanResult(null);
    setManualPayload('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#F1EBFF] text-[#6D28D9] text-xs font-bold uppercase tracking-wider mb-2">
            <ScanLine className="w-3.5 h-3.5" />
            <span>Terminal Gate Scanner</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">SmartPass Gate Verification</h1>
          <p className="text-sm text-[#777180] mt-1">Live admission validation, attendance logging and +50 reward point credits</p>
        </div>
      </div>

      {/* Terminal Configuration Card */}
      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#777180] mb-3">Terminal Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#24212B]">Selected Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-xs font-bold text-[#24212B] bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212B]">Terminal Check-In Gate</label>
            <select
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value)}
              disabled={gates.length === 0}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-xs font-bold text-[#24212B] bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9] disabled:opacity-50"
            >
              {gates.length === 0 ? (
                <option value="">No gates configured for this event</option>
              ) : (
                gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.gateName} {g.locationDescription ? `· ${g.locationDescription}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* RESULT MODAL / HERO DISPLAY */}
      {scanResult && (
        <div className={`p-6 sm:p-8 rounded-3xl border-2 shadow-lg transition-all ${
          scanResult.status === 'APPROVED'
            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-emerald-100'
            : 'bg-rose-50 border-rose-400 text-rose-950 shadow-rose-100'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-3">
              {scanResult.status === 'APPROVED' ? (
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-200">
                  <XCircle className="w-8 h-8" />
                </div>
              )}

              <div>
                <span className={`text-xs font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  scanResult.status === 'APPROVED'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900'
                }`}>
                  {scanResult.status === 'APPROVED' ? 'ADMISSION APPROVED' : 'ENTRY REJECTED'}
                </span>
                <h2 className="text-2xl font-black mt-1">
                  {scanResult.status === 'APPROVED' ? 'Pass Redeemed Successfully' : scanResult.error.code}
                </h2>
              </div>
            </div>

            <button
              onClick={resetForNextAttendee}
              className="px-4 py-2 bg-white text-[#24212B] border border-current/20 rounded-xl font-bold text-xs hover:bg-white/80 transition-colors shadow-sm"
            >
              Scan Next Attendee
            </button>
          </div>

          {/* Details Body */}
          {scanResult.status === 'APPROVED' ? (
            <div className="mt-6 pt-6 border-t border-emerald-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/80 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Attendee</span>
                <p className="text-lg font-black text-emerald-950">{scanResult.data.attendee.name}</p>
                <p className="text-xs text-emerald-800 font-mono">{scanResult.data.attendee.studentId}</p>
                <p className="text-xs text-emerald-700">{scanResult.data.attendee.department}</p>
              </div>

              <div className="bg-white/80 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Event & Gate</span>
                <p className="text-sm font-bold text-emerald-950">{scanResult.data.eventTitle}</p>
                <p className="text-xs text-emerald-800 mt-1">Gate: <span className="font-bold">{scanResult.data.gateName}</span></p>
                <p className="text-[11px] text-emerald-700">Mode: Online Atomic Check-In</p>
              </div>

              <div className="bg-white/80 p-4 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Rewards Credited</span>
                  <p className="text-lg font-black text-[#16865B]">+50 Points</p>
                  <p className="text-[10px] text-emerald-700">Audit ledger recorded</p>
                </div>
                <p className="text-[10px] text-emerald-800 font-mono mt-2">
                  {new Date(scanResult.data.checkedInAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-rose-200 space-y-3">
              <div className="p-4 bg-white/80 rounded-2xl">
                <p className="text-sm font-extrabold text-rose-900 leading-relaxed">
                  {scanResult.error.message}
                </p>
                <p className="text-xs text-rose-700 mt-2 font-mono">
                  Payload: {scanResult.rawPayload}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scanner Visual Container */}
      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-[#6D28D9]" />
            <h2 className="text-base font-extrabold text-[#24212B]">Camera Scanner</h2>
          </div>
          <div>
            {scanning ? (
              <button
                onClick={stopCameraScanner}
                className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors"
              >
                Stop Camera
              </button>
            ) : (
              <button
                onClick={startCameraScanner}
                disabled={!selectedGateId}
                className="px-4 py-2 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold text-xs shadow-sm shadow-purple-200 transition-colors disabled:opacity-50"
              >
                Activate Camera
              </button>
            )}
          </div>
        </div>

        {cameraError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            {cameraError}
          </div>
        )}

        {/* Video / Html5Qrcode target div */}
        <div 
          id={scannerContainerId} 
          className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-slate-900 aspect-square flex items-center justify-center text-slate-400 text-xs"
        >
          {!scanning && <span>Camera deactivated. Tap "Activate Camera" or enter payload manually below.</span>}
        </div>

        {processing && (
          <div className="text-center text-xs font-bold text-[#6D28D9] animate-pulse">
            Processing atomic check-in transaction...
          </div>
        )}
      </div>

      {/* Manual Code Input Fallback */}
      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#777180]">
          Manual / Test Scanner Input
        </h3>
        <p className="text-xs text-[#777180]">
          Paste raw QR payload (e.g. <span className="font-mono text-purple-700">EVPASS:v1:PASS-...:...</span>) to test instant verification:
        </p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            required
            placeholder="EVPASS:v1:PASS-MWWBGCWH-2DE547:78b021a81239c091..."
            value={manualPayload}
            onChange={(e) => setManualPayload(e.target.value)}
            className="flex-1 px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
          />
          <button
            type="submit"
            disabled={processing || !selectedGateId}
            className="px-5 py-2.5 bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-xs font-bold rounded-xl shadow-sm shadow-purple-200 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {processing ? 'Verifying...' : 'Validate Scan'}
          </button>
        </form>
      </div>
    </div>
  );
}
