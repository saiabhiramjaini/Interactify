"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  MessageSquare,
  Users,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { HeroSection } from "@/components/hero-section";
import { motion, AnimatePresence } from "framer-motion";

const MotionCard = motion(Card);
const MotionButton = motion(Button);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 50,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  hover: {
    y: -10,
    scale: 1.02,
    transition: { 
      duration: 0.3,
      ease: "easeOut"
    },
  },
};

const stepVariants = {
  hidden: { 
    opacity: 0, 
    x: -20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
};

const iconVariants = {
  initial: { scale: 1 },
  hover: { 
    scale: 1.2,
    rotate: 5,
    transition: {
      duration: 0.2,
    },
  },
};

const buttonVariants = {
  initial: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: {
      duration: 0.2,
    },
  },
  tap: { 
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col">
        <div className="container mx-auto flex flex-1 flex-col px-4">
          <div className="">
            <HeroSection />
          </div>

          <motion.div 
            className="mx-auto flex flex-1 flex-col justify-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="grid h-full gap-8 md:grid-cols-2">
              {/* Presenter Card - Glass Morphism with Floating Elements */}
              <MotionCard
                className="group relative flex flex-col overflow-hidden border border-white/20 bg-white/10 backdrop-blur-lg dark:border-gray-800/50 dark:bg-gray-900/50"
                variants={cardVariants}
                whileHover="hover"
                initial="hidden"
                animate="visible"
              >
                {/* Floating background elements */}
                <motion.div 
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.div 
                  className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blue-400/10 blur-3xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <div className="relative flex flex-1 flex-col">
                  <CardHeader className="relative space-y-4 p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <motion.div 
                          className="relative"
                          variants={iconVariants}
                          whileHover="hover"
                        >
                          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-lg" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                            <Users className="h-6 w-6" />
                          </div>
                        </motion.div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                            Presenter
                          </CardTitle>
                          <CardDescription className="text-blue-600 dark:text-blue-400">
                            Host Interactive Sessions
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-8 pt-0">
                    <motion.div className="space-y-6">
                      {[
                        {
                          step: 1,
                          title: "Create a session",
                          description:
                            "Set up a new Q&A room for your presentation",
                          icon: <Sparkles className="h-5 w-5" />,
                        },
                        {
                          step: 2,
                          title: "Share the room code",
                          description:
                            "Invite your audience to join using a unique code",
                          icon: <ArrowRight className="h-5 w-5" />,
                        },
                        {
                          step: 3,
                          title: "Manage questions",
                          description:
                            "View, answer, and prioritize audience questions",
                          icon: <CheckCircle2 className="h-5 w-5" />,
                        },
                      ].map((item, index) => (
                        <motion.div
                          key={item.step}
                          className="group/step relative flex items-start gap-4 rounded-xl p-4 transition-all hover:bg-white/20 dark:hover:bg-gray-800/50"
                          variants={stepVariants}
                          custom={index}
                          whileHover="hover"
                        >
                          <motion.div 
                            className="relative"
                            variants={iconVariants}
                            whileHover="hover"
                          >
                            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md transition-all group-hover/step:bg-blue-500/30" />
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                              {item.icon}
                            </div>
                          </motion.div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>

                  <CardFooter className="border-t border-white/20 p-8 dark:border-gray-800/50">
                    <Link href="/presenter/create" className="w-full">
                      <MotionButton
                        className="w-full gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-lg font-medium text-white shadow-lg hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        Create Session
                        <ArrowRight className="h-5 w-5" />
                      </MotionButton>
                    </Link>
                  </CardFooter>
                </div>
              </MotionCard>

              {/* Attendee Card - Glass Morphism with Floating Elements */}
              <MotionCard
                className="group relative flex flex-col overflow-hidden border border-white/20 bg-white/10 backdrop-blur-lg dark:border-gray-800/50 dark:bg-gray-900/50"
                variants={cardVariants}
                whileHover="hover"
                initial="hidden"
                animate="visible"
              >
                {/* Floating background elements */}
                <motion.div 
                  className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.div 
                  className="absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-purple-400/10 blur-3xl"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.4, 0.2],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <div className="relative flex flex-1 flex-col">
                  <CardHeader className="relative space-y-4 p-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <motion.div 
                          className="relative"
                          variants={iconVariants}
                          whileHover="hover"
                        >
                          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                            <MessageSquare className="h-6 w-6" />
                          </div>
                        </motion.div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                            Attendee
                          </CardTitle>
                          <CardDescription className="text-purple-600 dark:text-purple-400">
                            Join & Engage
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-8 pt-0">
                    <motion.div className="space-y-6">
                      {[
                        {
                          step: 1,
                          title: "Join a session",
                          description:
                            "Enter the room code provided by the presenter",
                          icon: <ArrowRight className="h-5 w-5" />,
                        },
                        {
                          step: 2,
                          title: "Ask questions",
                          description: "Submit your questions to the presenter",
                          icon: <MessageSquare className="h-5 w-5" />,
                        },
                        {
                          step: 3,
                          title: "Vote on questions",
                          description: "Upvote questions you'd like answered",
                          icon: <CheckCircle2 className="h-5 w-5" />,
                        },
                      ].map((item, index) => (
                        <motion.div
                          key={item.step}
                          className="group/step relative flex items-start gap-4 rounded-xl p-4 transition-all hover:bg-white/20 dark:hover:bg-gray-800/50"
                          variants={stepVariants}
                          custom={index}
                          whileHover="hover"
                        >
                          <motion.div 
                            className="relative"
                            variants={iconVariants}
                            whileHover="hover"
                          >
                            <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-md transition-all group-hover/step:bg-purple-500/30" />
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
                              {item.icon}
                            </div>
                          </motion.div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {item.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>

                  <CardFooter className="border-t border-white/20 p-8 dark:border-gray-800/50">
                    <Link href="/attendee/join" className="w-full">
                      <MotionButton
                        className="w-full gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-lg font-medium text-white shadow-lg hover:from-purple-600 hover:to-purple-700 dark:from-purple-600 dark:to-purple-700 dark:hover:from-purple-700 dark:hover:to-purple-800"
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                      >
                        Join Session
                        <ArrowRight className="h-5 w-5" />
                      </MotionButton>
                    </Link>
                  </CardFooter>
                </div>
              </MotionCard>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
