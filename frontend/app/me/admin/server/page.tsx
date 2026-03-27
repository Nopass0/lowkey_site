"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Edit,
  Globe,
  KeyRound,
  Loader2,
  MapPin,
  PlusCircle,
  RefreshCw,
  Server,
  Trash2,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VpnServer {
  id: string;
  ip: string;
  hostname?: string | null;
  sshUsername?: string | null;
  hasSshPassword: boolean;
  port: number;
  supportedProtocols: string[];
  serverType: string;
  currentLoad: number;
  status: string;
  deployStatus: string;
  deployMessage: string | null;
  deployedAt: string | null;
  pm2ProcessName: string | null;
  location: string;
  connectLinkTemplate: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
}

interface ServerFormState {
  ip: string;
  hostname: string;
  location: string;
  sshUsername: string;
  sshPassword: string;
  pm2ProcessName: string;
  connectLinkTemplate: string;
}

const EMPTY_SERVER_FORM: ServerFormState = {
  ip: "",
  hostname: "",
  location: "",
  sshUsername: "",
  sshPassword: "",
  pm2ProcessName: "",
  connectLinkTemplate: "",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Не удалось выполнить запрос";
}

function createFormFromServer(server: VpnServer): ServerFormState {
  return {
    ip: server.ip,
    hostname: server.hostname ?? "",
    location: server.location ?? "",
    sshUsername: server.sshUsername ?? "",
    sshPassword: "",
    pm2ProcessName: server.pm2ProcessName ?? "",
    connectLinkTemplate: server.connectLinkTemplate ?? "",
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU");
}

function renderStatusBadge(status: string) {
  if (status === "online") {
    return (
      <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
        online
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-border/60">
      {status}
    </Badge>
  );
}

function renderDeployBadge(status: string) {
  if (status === "deployed") {
    return (
      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
        deployed
      </Badge>
    );
  }

  if (status === "deploying") {
    return (
      <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600">
        deploying
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="border-destructive/20 bg-destructive/10 text-destructive">
        failed
      </Badge>
    );
  }

  return <Badge variant="outline">{status}</Badge>;
}

function ServerFormFields({
  form,
  setForm,
  passwordRequired,
}: {
  form: ServerFormState;
  setForm: Dispatch<SetStateAction<ServerFormState>>;
  passwordRequired: boolean;
}) {
  const updateField = (field: keyof ServerFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid gap-5 py-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Публичный IP</Label>
          <Input
            value={form.ip}
            onChange={(event) => updateField("ip", event.target.value)}
            placeholder="203.0.113.10"
          />
        </div>
        <div className="space-y-2">
          <Label>Hostname</Label>
          <Input
            value={form.hostname}
            onChange={(event) => updateField("hostname", event.target.value)}
            placeholder="s1.lowkey.su"
          />
          <p className="text-xs text-muted-foreground">
            Домен должен уже смотреть на этот сервер, иначе certbot не выпустит
            сертификат.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Локация</Label>
          <Input
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="Frankfurt, Germany"
          />
        </div>
        <div className="space-y-2">
          <Label>PM2 process name</Label>
          <Input
            value={form.pm2ProcessName}
            onChange={(event) => updateField("pm2ProcessName", event.target.value)}
            placeholder="hysteria-s1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>SSH username</Label>
          <Input
            value={form.sshUsername}
            onChange={(event) => updateField("sshUsername", event.target.value)}
            placeholder="root"
          />
        </div>
        <div className="space-y-2">
          <Label>
            SSH password
            {passwordRequired ? "" : " (оставьте пустым, чтобы не менять)"}
          </Label>
          <Input
            type="password"
            value={form.sshPassword}
            onChange={(event) => updateField("sshPassword", event.target.value)}
            placeholder={passwordRequired ? "Введите пароль" : "Новый пароль"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Шаблон ссылки подключения</Label>
        <Textarea
          value={form.connectLinkTemplate}
          onChange={(event) =>
            updateField("connectLinkTemplate", event.target.value)
          }
          placeholder="vless://{uuid}@{host}:443?encryption=none&security=tls&sni={host}"
          className="min-h-[140px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Поддерживаются переменные: <code>{"{uuid}"}</code>,{" "}
          <code>{"{ip}"}</code>, <code>{"{host}"}</code>.
        </p>
      </div>
    </div>
  );
}

function CreateServerDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCreate: (form: ServerFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<ServerFormState>(EMPTY_SERVER_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_SERVER_FORM);
      setIsSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onCreate(form);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Новый VPN-сервер</DialogTitle>
          <DialogDescription>
            Сохраните IP, SSH-доступ и hostname. После этого сервер можно сразу
            развернуть из панели через SSH и pm2.
          </DialogDescription>
        </DialogHeader>

        <ServerFormFields
          form={form}
          setForm={setForm}
          passwordRequired={true}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохраняю...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditServerDialog({
  server,
  onUpdate,
}: {
  server: VpnServer;
  onUpdate: (id: string, form: ServerFormState) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServerFormState>(createFormFromServer(server));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(createFormFromServer(server));
  }, [server, open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(server.id, form);
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-lg"
        onClick={() => setOpen(true)}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Редактирование сервера</DialogTitle>
          <DialogDescription>
            Можно изменить SSH-доступ, hostname, шаблон ссылки и PM2 process
            name.
          </DialogDescription>
        </DialogHeader>

        <ServerFormFields
          form={form}
          setForm={setForm}
          passwordRequired={false}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохраняю...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminServersPage() {
  const { user } = useAuth();
  const [servers, setServers] = useState<VpnServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deployingIds, setDeployingIds] = useState<string[]>([]);

  const fetchServers = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) {
        setRefreshing(true);
      }

      try {
        const data = await apiClient.get<VpnServer[]>("/admin/server/list");
        setServers(data);
      } catch (error) {
        console.error("Failed to fetch servers", error);
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (user?.isAdmin) {
      void fetchServers();
    }
  }, [fetchServers, user]);

  useEffect(() => {
    if (!servers.some((server) => server.deployStatus === "deploying")) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchServers();
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [fetchServers, servers]);

  const handleCreate = async (form: ServerFormState) => {
    await apiClient.post("/admin/server", {
      ip: form.ip,
      hostname: form.hostname,
      location: form.location,
      sshUsername: form.sshUsername,
      sshPassword: form.sshPassword,
      pm2ProcessName: form.pm2ProcessName || undefined,
      connectLinkTemplate: form.connectLinkTemplate || null,
    });
    toast.success("Сервер добавлен");
    await fetchServers();
  };

  const handleUpdate = async (id: string, form: ServerFormState) => {
    await apiClient.patch(`/admin/server/${id}`, {
      ip: form.ip,
      hostname: form.hostname || null,
      location: form.location,
      sshUsername: form.sshUsername || null,
      sshPassword: form.sshPassword,
      pm2ProcessName: form.pm2ProcessName || null,
      connectLinkTemplate: form.connectLinkTemplate || null,
    });
    toast.success("Сервер обновлён");
    await fetchServers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот сервер из панели?")) {
      return;
    }

    try {
      await apiClient.delete(`/admin/server/${id}`);
      toast.success("Сервер удалён");
      await fetchServers();
    } catch (error) {
      console.error("Failed to delete server", error);
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeploy = async (id: string) => {
    try {
      setDeployingIds((prev) => [...prev, id]);
      await apiClient.post(`/admin/server/${id}/deploy`);
      toast.success("Развёртывание запущено");
      await fetchServers();
    } catch (error) {
      console.error("Failed to start deployment", error);
      toast.error(getErrorMessage(error));
    } finally {
      setDeployingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader size={40} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Server className="h-8 w-8 text-primary" />
            VPN-серверы
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Добавляйте ноды по IP и SSH-доступу, после чего админка сама
            подключится по SSH, склонирует `lowkey_hysteria`, выпустит
            сертификат через certbot и поднимет сервис через pm2.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void fetchServers(true)}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Обновить
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Добавить сервер
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[130px]">Статус</TableHead>
              <TableHead>Сервер</TableHead>
              <TableHead>SSH / PM2</TableHead>
              <TableHead>Деплой</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-36 text-center text-muted-foreground"
                >
                  Серверы ещё не добавлены
                </TableCell>
              </TableRow>
            ) : (
              servers.map((server) => {
                const isDeploying =
                  server.deployStatus === "deploying" ||
                  deployingIds.includes(server.id);

                return (
                  <TableRow key={server.id} className="align-top">
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {renderStatusBadge(server.status)}
                        <Badge variant="outline">
                          load: {server.currentLoad}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 font-semibold">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {server.location || "Unknown, UN"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Globe className="h-4 w-4" />
                          <span className="font-mono">
                            {server.hostname
                              ? `${server.hostname} (${server.ip}:${server.port})`
                              : `${server.ip}:${server.port}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {server.supportedProtocols.map((protocol) => (
                            <Badge key={protocol} variant="secondary">
                              {protocol}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Последний heartbeat: {formatDateTime(server.lastSeenAt)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <span>{server.sshUsername || "—"}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Пароль: {server.hasSshPassword ? "сохранён" : "не задан"}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Wrench className="h-4 w-4" />
                          <span className="font-mono">
                            {server.pm2ProcessName || "авто"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex max-w-[320px] flex-col gap-2">
                        {renderDeployBadge(server.deployStatus)}
                        <div className="text-xs text-muted-foreground">
                          Последний деплой: {formatDateTime(server.deployedAt)}
                        </div>
                        {server.deployMessage ? (
                          <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                            <div className="line-clamp-4 whitespace-pre-wrap break-words font-mono">
                              {server.deployMessage}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => void handleDeploy(server.id)}
                          disabled={isDeploying}
                        >
                          {isDeploying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Deploying
                            </>
                          ) : (
                            <>
                              <Wrench className="h-4 w-4" />
                              Deploy
                            </>
                          )}
                        </Button>

                        <EditServerDialog
                          server={server}
                          onUpdate={handleUpdate}
                        />

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void handleDelete(server.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateServerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (form) => {
          try {
            await handleCreate(form);
          } catch (error) {
            toast.error(getErrorMessage(error));
            throw error;
          }
        }}
      />
    </div>
  );
}
