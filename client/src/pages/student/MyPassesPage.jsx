import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  QrCode, 
  RefreshCw, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill.jsx';

export function MyPassesPage() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [qrCache, setQrCache] = useState({}); // Stores qrDataUrl and qrPayload keyed by passId
  const [loading, setLoading] = useState(true);
  const [reissuingPassId, setReissuingPassId] = useState(null);
  const [reissueModalPass, setReissueModalPass] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchPasses = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/passes/my-passes');
      if (res.data?.success) {
        setPasses(res.data.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load passes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
  }, []);

  const handleReissue = async (passId) => {
    try {
      setReissuingPassId(passId);
      setError('');
      setMessage('');

      const res = await api.post(`/passes/${passId}/reissue`);
      if (res.data?.success) {
        const { qrDataUrl, qrPayload, passCode } = res.data.data;
        // Update QR cache
        setQrCache(prev => ({
          ...prev,
          [passId]: { qrDataUrl, qrPayload }
        }));
        setMessage(`Pass ${passCode} reissued successfully! Previous QR codes are immediately invalid.`);
        setReissueModalPass(null);
      }
    } catch (err) {
      setError(err.message || 'Pass reissuance failed.');
    } finally {
      setReissuingPassId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">My SmartPasses</h1>
          <p className="text-sm text-[#777180] mt-1">Cryptographically verified personal event admission passes</p>
        </div>
        <button
          onClick={fetchPasses}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#EAE6F0] hover:bg-slate-50 text-xs font-bold text-[#777180] flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle className="w-4 h-4 text-[#16865B] flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Passes List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-80 rounded-3xl bg-white border border-[#EAE6F0] p-6 animate-pulse" />
          ))}
        </div>
      ) : passes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EAE6F0] p-12 text-center max-w-md mx-auto">
          <QrCode className="w-12 h-12 text-[#6D28D9] mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-[#24212B]">No Passes Issued Yet</h3>
          <p className="text-xs text-[#777180] mt-1">Register for an event to receive your blind-verified SmartPass.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {passes.map((pass) => {
            const cachedQr = qrCache[pass.passId];
            const isCheckedIn = pass.status === 'checked_in';
            const isInactive = pass.status === 'revoked' || pass.status === 'expired';

            return (
              <div 
                key={pass.passId}
                className="bg-white rounded-3xl border border-[#EAE6F0] hover:border-purple-300 shadow-sm overflow-hidden flex flex-col justify-between transition-all"
              >
                {/* Header Strip */}
                <div className="p-6 bg-gradient-to-r from-purple-900 to-[#6D28D9] text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold tracking-wider text-purple-200">{pass.passCode}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                      {pass.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold mt-3 tracking-tight line-clamp-1">{pass.eventTitle}</h3>
                  <div className="mt-2 flex items-center space-x-3 text-xs text-purple-100">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(pass.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="line-clamp-1">{pass.venue}</span>
                    </span>
                  </div>
                </div>

                {/* Body Content & QR Display */}
                <div className="p-6 flex flex-col items-center justify-center space-y-4">
                  {cachedQr?.qrDataUrl ? (
                    <div className="p-3 bg-white border-2 border-purple-200 rounded-2xl shadow-inner text-center">
                      <img 
                        src={cachedQr.qrDataUrl} 
                        alt={`QR Code for ${pass.passCode}`} 
                        className="w-48 h-48 mx-auto"
                      />
                      <p className="text-[10px] text-[#777180] font-mono mt-2 select-all">
                        {cachedQr.qrPayload}
                      </p>
                    </div>
                  ) : (
                    <div className="w-48 h-48 border-2 border-dashed border-[#EAE6F0] rounded-2xl flex flex-col items-center justify-center p-4 text-center bg-[#FAF9FC]">
                      <QrCode className="w-10 h-10 text-[#6D28D9] mb-2 opacity-50" />
                      <p className="text-xs font-semibold text-[#24212B]">Anti-Screenshot Shield</p>
                      <p className="text-[10px] text-[#777180] mt-1">Tap below to render your live scan token</p>
                    </div>
                  )}

                  {/* Verification Note */}
                  <div className="text-center text-xs text-[#777180]">
                    {isCheckedIn ? (
                      <span className="text-[#16865B] font-bold flex items-center justify-center space-x-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>Pass Redeemed at Gate · Attendance Recorded (+50 pts)</span>
                      </span>
                    ) : isInactive ? (
                      <span className="text-[#DC4040] font-bold">This pass is {pass.status} and cannot be scanned.</span>
                    ) : (
                      <span className="flex items-center justify-center space-x-1 text-[#6D28D9] font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Present at scanner terminal for instant gate admission</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-[#FAF9FC] border-t border-[#EAE6F0] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#777180]">
                    Issued: {new Date(pass.issuedAt).toLocaleDateString()}
                  </span>

                  {!isCheckedIn && !isInactive && (
                    <button
                      onClick={() => setReissueModalPass(pass)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#EAE6F0] hover:border-purple-300 text-[#6D28D9] hover:bg-purple-50 font-bold flex items-center space-x-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{cachedQr ? 'Reissue New QR' : 'Display / Refresh QR'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reissue Confirmation Modal */}
      {reissueModalPass && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#EAE6F0] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#24212B]">
                Rotate & Reissue SmartPass?
              </h3>
              <p className="text-xs text-[#777180] mt-1 leading-relaxed">
                Reissuing generates a completely fresh 256-bit cryptographically secure token and updates the SHA-256 blind hash in the database.
              </p>
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                ⚠️ Any previous screenshots, printed passes, or saved QR images will be immediately rejected at the gate terminal.
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setReissueModalPass(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#EAE6F0] text-xs font-bold text-[#777180] hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reissuingPassId === reissueModalPass.passId}
                onClick={() => handleReissue(reissueModalPass.passId)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {reissuingPassId === reissueModalPass.passId ? 'Rotating Hash...' : 'Confirm Reissue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
