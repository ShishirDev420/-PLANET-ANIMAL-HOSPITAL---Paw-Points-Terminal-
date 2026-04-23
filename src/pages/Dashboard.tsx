import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, writeBatch, increment, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Search, PawPrint, Bell, X } from 'lucide-react';

interface ToastNotification {
  id: string;
  patient: string;
  service: string;
  pointsValue: number;
}

interface PointsRequest {
  id: string;
  patient?: string;
  petName?: string;
  pointsValue: number;
  service: string;
  status: 'pending' | 'verified';
  createdAt?: any;
  date?: string;
  time?: string;
  userId?: string;
}

interface UserDirectory {
  id: string;
  petName?: string;
  email?: string;
  pawPoints?: number;
}

export default function Dashboard() {
  const [queue, setQueue] = useState<PointsRequest[]>([]);
  const [directory, setDirectory] = useState<UserDirectory[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  const dismissToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  const addToast = (request: PointsRequest) => {
    const toast: ToastNotification = {
      id: request.id,
      patient: request.patient || request.petName || 'Unknown Patient',
      service: request.service || 'Service',
      pointsValue: request.pointsValue || 0,
    };
    setToasts(prev => [toast, ...prev].slice(0, 5)); // max 5 toasts
    setTimeout(() => dismissToast(request.id), 6000); // auto-dismiss after 6s
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDirectory | null>(null);
  const [customPoints, setCustomPoints] = useState<string>("");
  const [isAddPointsModalOpen, setIsAddPointsModalOpen] = useState(false);

  const handleManualPointsInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !customPoints || isNaN(Number(customPoints))) return;
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, { pawPoints: increment(Number(customPoints)) });
      setIsAddPointsModalOpen(false);
      setCustomPoints("");
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error adding manual points:", error);
      alert("Failed to add points.");
    }
  };

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users: UserDirectory[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as UserDirectory);
      });
      setDirectory(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    // Listen to the requests collection in real-time
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: PointsRequest[] = [];
      snapshot.forEach((docSnap) => {
        requests.push({ id: docSnap.id, ...docSnap.data() } as PointsRequest);
      });
      
      // Sort manually to prevent orderBy index failures inside Firebase
      requests.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      // Detect truly NEW requests (not seen before) and fire toast notifications
      if (isInitialLoadRef.current) {
        // Seed the seen set on first load — don't toast for pre-existing items
        requests.forEach(r => seenRequestIdsRef.current.add(r.id));
        isInitialLoadRef.current = false;
      } else {
        requests.forEach(r => {
          if (!seenRequestIdsRef.current.has(r.id)) {
            seenRequestIdsRef.current.add(r.id);
            addToast(r);
          }
        });
      }
      
      setQueue(requests);
    }, (error) => {
      console.error("Error fetching points queue:", error);
    });

    // Fetch initial users directory
    fetchUsers();

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const handleApprove = async (request: PointsRequest) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Update the queue ticket
      const queueRef = doc(db, 'requests', request.id);
      batch.update(queueRef, { status: 'verified' });

      // 2. Increment the user's Paw Points
      if (request.userId) {
        const userRef = doc(db, 'users', request.userId);
        batch.update(userRef, { pawPoints: increment(request.pointsValue || 0) });
      }

      // 3. Commit the transaction
      await batch.commit();

      // Refresh directory locally to show updated points quickly
      fetchUsers();
    } catch (error) {
      console.error("Error committing batch: ", error);
      alert("Transaction failed. Please try again.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const requestRef = doc(db, 'requests', id);
      await deleteDoc(requestRef);
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const handleSendInvite = () => {
    const subject = encodeURIComponent("Exclusive Invite: Planet Animal Hospital's New Proactive Care App ✨");
    const body = encodeURIComponent("Hi there! We are selecting a few of our VIP pet parents to beta test our new Proactive Care App. You can sign up here to start earning Paw Points for your pet's visits: [INSERT_APP_URL_HERE]");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const filteredDirectory = directory.filter(user => 
    (user.petName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-yellow-500/30"
    >
      {/* Header */}
      <header className="bg-[#0A0A0A]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0 w-12 h-12">
            {/* Glowy Orb Animation Behind Logo */}
            <div className="absolute inset-0 bg-yellow-500/20 blur-[20px] animate-pulse rounded-full scale-[1.75]"></div>
            <div className="relative w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-[#0A0A0A] shadow-[0_0_15px_rgba(250,204,21,0.5)] overflow-hidden border-2 border-[#121212] z-10">
              <img 
                src="https://drive.google.com/thumbnail?id=1zldPukvYCnUvn5i2V9gqpDuR8WKhZ1_4&sz=w500" 
                alt="Planet Animal Hospital" 
                className="w-full h-full object-cover relative z-20"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div style={{ display: 'none' }} className="absolute inset-0 items-center justify-center bg-yellow-500 z-10 w-full h-full">
                <span className="text-xl font-black leading-none tracking-tighter drop-shadow-sm">PA</span>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md pb-0.5">Planet Animal CRM</h1>
            <p className="text-[10px] text-yellow-500 font-bold tracking-[0.2em] uppercase">Staff Omnichannel Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSendInvite}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-yellow-500 bg-transparent border border-gray-700 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none mt-[1px]">+</span> Invite Pet Parent
          </button>
          <div className="text-sm text-gray-400 font-medium hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#121212] border border-gray-800 rounded-full shadow-inner">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div>
            Live Sync Active
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6 pb-20 space-y-12">
        {/* Incoming Queue Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
              Incoming Queue
              <span className="bg-yellow-500/10 text-yellow-500 text-xs py-1 px-2.5 rounded-md border border-yellow-500/20 shadow-inner">
                {queue.length} Pending
              </span>
            </h2>
            <p className="text-sm text-gray-400">Review and approve point requests coming from the consumer app.</p>
          </div>

          <div className="bg-[#121212] border border-gray-800 rounded-xl shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#1A1A1C] border-b border-gray-800 text-gray-400 uppercase tracking-widest text-[11px] font-semibold">
                  <tr>
                    <th className="px-6 py-4">Patient</th>
                    <th className="px-6 py-4">Service / Reason</th>
                    <th className="px-6 py-4">Appointment Details</th>
                    <th className="px-6 py-4">Points to Award</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <motion.tbody className="divide-y divide-gray-800/50">
                  <AnimatePresence mode="popLayout">
                    {queue.length === 0 ? (
                      <motion.tr 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                      >
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                          All caught up. No pending requests.
                        </td>
                      </motion.tr>
                    ) : (
                      queue.map((request) => (
                        <motion.tr 
                          layout
                          key={request.id} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          className="hover:bg-[#18181A] transition-colors group"
                        >
                          <td className="px-6 py-4 font-medium text-white">{request.patient || request.petName || 'Unknown Patient'}</td>
                          <td className="px-6 py-4 text-gray-500">{request.service || 'No service provided'}</td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                            {request.date && request.time 
                              ? `${request.date} / ${request.time}`
                              : request.createdAt 
                                ? new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleString() 
                                : 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-bold text-yellow-400 text-base drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                            +{request.pointsValue || 0}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleApprove(request)}
                                className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0A0A0A] bg-yellow-500 rounded border border-yellow-400 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#121212] focus:ring-yellow-500 transition-all shadow-[0_0_15px_rgba(250,204,21,0.15)] hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:-translate-y-0.5"
                              >
                                Confirm Visit & Award
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                className="inline-flex items-center justify-center px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-transparent border border-gray-700 rounded hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#121212] focus:ring-red-500 transition-colors"
                              >
                                Cancel / No-Show
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Patient Directory Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Patient Directory</h2>
              <p className="text-sm text-gray-400">Search and manage all authenticated patients' CRM profiles.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text"
                placeholder="Search by Pet Name or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 pl-10 pr-4 py-2 bg-[#121212] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all shadow-inner text-sm"
              />
            </div>
          </div>

          <div className="bg-[#121212] border border-gray-800 rounded-xl shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#1A1A1C] border-b border-gray-800 text-gray-400 uppercase tracking-widest text-[11px] font-semibold">
                  <tr>
                    <th className="px-6 py-4">Pet Name</th>
                    <th className="px-6 py-4">Owner Email</th>
                    <th className="px-6 py-4">Lifetime Paw Points</th>
                    <th className="px-6 py-4 text-right">Actions / CRM ID</th>
                  </tr>
                </thead>
                <motion.tbody className="divide-y divide-gray-800/50">
                  <AnimatePresence mode="popLayout">
                    {filteredDirectory.length === 0 ? (
                      <motion.tr 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                      >
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                          {searchQuery ? "No patients matching your search." : "Directory empty or loading."}
                        </td>
                      </motion.tr>
                    ) : (
                      filteredDirectory.map((user, index) => (
                        <motion.tr 
                          layout
                          key={user.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 < 0.5 ? index * 0.05 : 0 } }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-[#18181A] transition-colors"
                        >
                          <td className="px-6 py-4 font-semibold text-white tracking-wide">
                            {user.petName || 'Unregistered'}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {user.email || 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-bold text-yellow-500 drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]">
                            {user.pawPoints || 0}
                          </td>
                          <td className="px-6 py-4 text-right flex flex-col items-end gap-2">
                            <span className="text-[10px] uppercase text-gray-600 font-mono tracking-widest">{user.id}</span>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setIsAddPointsModalOpen(true);
                              }}
                              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A] bg-yellow-500 rounded border border-yellow-400 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#121212] focus:ring-yellow-500 transition-all shadow-[0_0_15px_rgba(250,204,21,0.15)]"
                            >
                              + Add Points
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {isAddPointsModalOpen && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#121212] border border-gray-800 shadow-2xl rounded-2xl p-6 w-full max-w-sm relative"
            >
              <h3 className="text-xl font-bold text-white mb-2">Inject Paw Points</h3>
              <p className="text-sm text-gray-400 mb-6">Patient: <span className="text-white font-semibold">{selectedUser.petName || 'Unknown'}</span></p>
              
              <form onSubmit={handleManualPointsInjection} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Points to Add</label>
                  <input 
                    type="number"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full bg-[#1A1A1C] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all text-lg font-bold"
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddPointsModalOpen(false);
                      setCustomPoints("");
                      setSelectedUser(null);
                    }}
                    className="flex-1 py-3 bg-transparent border border-gray-700 text-gray-300 font-bold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!customPoints || isNaN(Number(customPoints))}
                    className="flex-1 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🐾 LIVE PAW POINTS NOTIFICATION TOASTS */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto w-[340px] bg-[#0E0E0E] border border-yellow-500/30 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.15),0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Yellow top accent line */}
              <div className="h-1 w-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 animate-pulse" />
              
              <div className="p-4 flex items-start gap-3">
                {/* Paw icon with glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-yellow-500/30 blur-xl rounded-full scale-150" />
                  <div className="relative w-10 h-10 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center justify-center">
                    <PawPrint className="w-5 h-5 text-yellow-400 fill-yellow-400/30" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-400">
                      <Bell className="w-2.5 h-2.5" /> Paw Points Request
                    </span>
                    <span className="text-[10px] text-gray-600 ml-auto">Just now</span>
                  </div>
                  <p className="text-white font-bold text-sm truncate">{toast.patient}</p>
                  <p className="text-gray-400 text-xs truncate">{toast.service}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">
                    <PawPrint className="w-3 h-3 text-yellow-400 fill-yellow-400/30" />
                    <span className="text-yellow-400 font-black text-sm">+{toast.pointsValue}</span>
                    <span className="text-yellow-400/60 text-xs font-bold">pts pending approval</span>
                  </div>
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 p-1 text-gray-600 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

