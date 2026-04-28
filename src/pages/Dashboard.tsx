import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, writeBatch, increment, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';

interface PointsRequest {
  id: string;
  patient: string;
  points: number;
  reason: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    // Listen to the requests collection in real-time
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: PointsRequest[] = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as PointsRequest);
      });
      
      // Sort manually to prevent orderBy index failures inside Firebase
      requests.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      
      setQueue(requests);
    }, (error) => {
      console.error("Error fetching points queue:", error);
    });

    // Listen to the users directory in real-time
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserDirectory[];
      setDirectory(usersList);
    }, (error) => {
      console.error("Error fetching users directory:", error);
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
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
        batch.update(userRef, { pawPoints: increment(request.points) });
      }

      // 3. Commit the transaction
      await batch.commit();

      setToast({ 
        message: `Success! ${request.points} Paw Points awarded to ${request.patient || 'patient'}.`, 
        type: 'success' 
      });

      // Directory updates automatically via onSnapshot listener
    } catch (error) {
      console.error("Error committing batch: ", error);
      setToast({ 
        message: "Transaction failed. Missing or insufficient permissions.", 
        type: 'error' 
      });
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
      className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-yellow-500/30 relative"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-24 left-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl border font-medium text-sm backdrop-blur-md flex items-center gap-2 ${
              toast.type === 'success' 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-red-500/10 border-red-500/30 text-red-500'
            }`}
          >
            {toast.type === 'success' ? (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

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
                          <td className="px-6 py-4 font-medium text-white">{request.patient || 'Unknown Patient'}</td>
                          <td className="px-6 py-4 text-gray-500">{request.reason || 'No reason provided'}</td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                            {request.date && request.time 
                              ? `${request.date} / ${request.time}`
                              : request.createdAt 
                                ? new Date(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt).toLocaleString() 
                                : 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-bold text-yellow-400 text-base drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                            +{request.points || 0}
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
                    <th className="px-6 py-4 text-right">CRM ID</th>
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
                          <td className="px-6 py-4 text-right text-[10px] uppercase text-gray-600 font-mono tracking-widest">
                            {user.id}
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
    </motion.div>
  );
}
