// src/app/(app)/flashcards/loading.tsx
// UPDATED FILE

import { Skeleton } from "@/components/ui/skeleton";
import { DeckCardSkeleton } from "@/components/skeletons/DeckCardSkeleton"; // <-- Use specific skeleton
import { motion } from 'framer-motion'; // <-- Import motion

// --- Animation Variants (copied from FlashcardsClientComponent) ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  },
};
// ---

export default function FlashcardsLoading() {
  return (
    <>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <Skeleton className="h-9 w-52 rounded mb-2" /> {/* Title */}
          <Skeleton className="h-4 w-48 rounded" /> {/* Usage */}
        </div>
        <Skeleton className="h-10 w-32 rounded-md" /> {/* New Button */}
      </div>

      {/* Grid Skeleton --- WRAPPED IN MOTION --- */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {[...Array(6)].map((_, i) => (
          <motion.div key={i} variants={itemVariants}>
            <DeckCardSkeleton />
          </motion.div>
        ))}
      </motion.div>
    </>
  );
}