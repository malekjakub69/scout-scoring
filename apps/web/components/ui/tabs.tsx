"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
  ComponentRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex h-11 w-full items-center justify-start overflow-x-auto border-b-1.5 border-scout-border bg-white px-7",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
  ComponentRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-full items-center justify-center whitespace-nowrap border-b-2.5 border-transparent px-4.5 text-13 font-normal text-scout-text-muted transition-all -mb-0.75",
      "hover:text-scout-text",
      "focus-visible:outline-none focus-visible:text-scout-text",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border-scout-yellow data-[state=active]:font-semibold data-[state=active]:text-scout-blue",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  ComponentRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
