"use client";

import { useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
  type AdminActionState,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  birthYear: number;
  isAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export function UserManagement({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const t = useTranslations("settings");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button size="sm">{t("createUser")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createUser")}</DialogTitle>
            <DialogDescription>
              The user will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm onSuccess={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.displayName}
                {user.isAdmin && (
                  <Badge variant="secondary" className="ml-2">
                    Admin
                  </Badge>
                )}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                {!user.isActive ? (
                  <Badge variant="destructive">Inactive</Badge>
                ) : user.mustChangePassword ? (
                  <Badge variant="outline">Must change password</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString()
                  : "Never"}
              </TableCell>
              <TableCell className="text-right">
                <UserActions
                  user={user}
                  isSelf={user.id === currentUserId}
                  onResetPassword={() => setResetOpen(user.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!resetOpen} onOpenChange={() => setResetOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetPassword")}</DialogTitle>
            <DialogDescription>
              Set a temporary password. The user will be forced to change it on next login.
            </DialogDescription>
          </DialogHeader>
          {resetOpen && (
            <ResetPasswordForm
              userId={resetOpen}
              onSuccess={() => setResetOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserActions({
  user,
  isSelf,
  onResetPassword,
}: {
  user: UserRow;
  isSelf: boolean;
  onResetPassword: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();

  async function handleToggleActive() {
    if (user.isActive) {
      await deactivateUserAction(user.id);
    } else {
      await reactivateUserAction(user.id);
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onResetPassword}>
        {t("resetPassword")}
      </Button>
      {!isSelf && (
        <Button
          variant={user.isActive ? "destructive" : "secondary"}
          size="sm"
          onClick={handleToggleActive}
        >
          {user.isActive ? t("deactivateUser") : "Reactivate"}
        </Button>
      )}
    </div>
  );
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const tAuth = useTranslations("auth");
  const tSetup = useTranslations("setup");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    async (prev, formData) => {
      const result = await createUserAction(prev, formData);
      if (result?.success) {
        router.refresh();
        onSuccess();
      }
      return result;
    },
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="create-email">{tAuth("email")}</Label>
        <Input id="create-email" name="email" type="email" required />
        <FieldError errors={state?.fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-displayName">{tSetup("displayName")}</Label>
        <Input id="create-displayName" name="displayName" required />
        <FieldError errors={state?.fieldErrors?.displayName} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="create-birthYear">{tSetup("birthYear")}</Label>
          <Input
            id="create-birthYear"
            name="birthYear"
            type="number"
            min={1940}
            max={2010}
            required
          />
          <FieldError errors={state?.fieldErrors?.birthYear} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-salary">{tSetup("salary")}</Label>
          <Input
            id="create-salary"
            name="currentSalary"
            type="number"
            step="0.01"
            min="0"
            required
          />
          <FieldError errors={state?.fieldErrors?.currentSalaryCents} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-password">Temporary password</Label>
        <Input
          id="create-password"
          name="temporaryPassword"
          type="password"
          minLength={12}
          required
        />
        <FieldError errors={state?.fieldErrors?.temporaryPassword} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "..." : tCommon("create")}
      </Button>
    </form>
  );
}

function ResetPasswordForm({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: () => void;
}) {
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    async (prev, formData) => {
      const result = await resetPasswordAction(prev, formData);
      if (result?.success) {
        router.refresh();
        onSuccess();
      }
      return result;
    },
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      {state?.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="reset-password">New temporary password</Label>
        <Input
          id="reset-password"
          name="newPassword"
          type="password"
          minLength={12}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "..." : tCommon("save")}
      </Button>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}
