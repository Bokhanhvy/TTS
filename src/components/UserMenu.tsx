import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Shield, User as UserIcon } from "lucide-react";

export function UserMenu() {
  const { user, isAdmin, signOut, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) {
    return <Button size="sm" variant="outline" onClick={() => navigate({ to: "/auth" })}>Sign in</Button>;
  }
  const initial = (user.email ?? "U")[0].toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="h-7 w-7"><AvatarFallback>{initial}</AvatarFallback></Avatar>
          <span className="hidden sm:inline text-xs max-w-[140px] truncate">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="h-3.5 w-3.5" /> {user.email}
        </DropdownMenuLabel>
        {isAdmin && (
          <DropdownMenuLabel className="flex items-center gap-2 text-primary">
            <Shield className="h-3.5 w-3.5" /> Admin
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
          <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}