"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LogIn, UserPlus, User, Key, X } from "lucide-react";

interface AuthFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthForm({ isOpen, onClose }: AuthFormProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { login: doLogin } = useAuth();
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      doLogin(login);
      onClose();
      router.push("/me");
    }
  };

  const isFormValid =
    login.trim() !== "" && password.trim() !== "" && termsAccepted;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-background/50 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm sm:max-w-[400px] z-10"
          >
            <Card className="border-border/50 relative overflow-hidden bg-background">
              {/* Decorative elements */}
              <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 rounded-full w-8 h-8 text-muted-foreground hover:bg-muted/50 transition-colors z-20"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Закрыть</span>
              </Button>

              <CardHeader className="space-y-2 text-center relative z-10 pt-8 sm:pt-10">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="mx-auto bg-primary/10 p-3.5 rounded-2xl mb-2 w-fit"
                >
                  <LogIn className="w-6 h-6 text-primary" />
                </motion.div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Вход
                </CardTitle>
                <CardDescription className="text-sm">
                  Введите логин и пароль для доступа к аккаунту
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <form
                  className="space-y-6 flex-1 flex flex-col gap-5"
                  onSubmit={handleLogin}
                >
                  <motion.div
                    className="grid gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <Label htmlFor="login" className="font-medium">
                      Логин
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login"
                        type="text"
                        placeholder="Ваш логин"
                        className="pl-10 h-11 bg-muted/30 focus-visible:bg-transparent transition-colors"
                        value={login}
                        onChange={(e) => setLogin(e.target.value)}
                        required
                      />
                    </div>
                  </motion.div>
                  <motion.div
                    className="grid gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                  >
                    <Label htmlFor="password" className="font-medium">
                      Пароль
                    </Label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11 bg-muted/30 focus-visible:bg-transparent transition-colors"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </motion.div>
                </form>
              </CardContent>
              <CardFooter className="flex-col gap-3 pb-8 relative z-10">
                <motion.div
                  className="w-full flex items-start px-2 gap-3 pb-2 pt-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <Checkbox
                    id="terms"
                    required
                    className="mt-0.5 shrink-0"
                    checked={termsAccepted}
                    onCheckedChange={(checked) =>
                      setTermsAccepted(checked as boolean)
                    }
                  />
                  <label
                    htmlFor="terms"
                    className="text-xs text-muted-foreground leading-snug font-normal cursor-pointer text-left block flex-1"
                  >
                    Регистрируясь или входя в систему, я принимаю условия{" "}
                    <a
                      href="/legal/offer"
                      className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                    >
                      Оферты
                    </a>{" "}
                    и{" "}
                    <a
                      href="/legal/privacy"
                      className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                    >
                      Политики
                    </a>
                    .
                  </label>
                </motion.div>
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-11 font-medium group text-sm sm:text-base cursor-pointer"
                    disabled={!isFormValid}
                  >
                    <LogIn className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Войти
                  </Button>
                </motion.div>
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <Button
                    variant="outline"
                    type="submit"
                    className="w-full h-11 font-medium text-sm sm:text-base bg-transparent hover:bg-muted/50 cursor-pointer group"
                    disabled={!isFormValid}
                  >
                    <UserPlus className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                    Регистрация
                  </Button>
                </motion.div>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
