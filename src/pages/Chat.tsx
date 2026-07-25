import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface Message {
    id: string;
    sender_id: string;
    message: string;
    created_at: string;
    is_read: boolean;
}

interface ReferralInfo {
    id: string;
    facility: string; // Used for doctor name if generic, or we fetch doctor profile
    status: string;
    doctor_id: string;
    doctor?: {
        full_name: string;
        photo_url?: string;
    };
}

import { LanguageProvider } from "@/contexts/LanguageContext";

function ChatContent() {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [referral, setReferral] = useState<ReferralInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!id) return;
        checkAuthAndFetch();

        // Subscribe to new messages
        const channel = supabase
            .channel(`chat:${id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `referral_id=eq.${id}` },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const checkAuthAndFetch = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth');
            return;
        }
        setCurrentUser(user);

        // Fetch referral info and messages
        await fetchReferral(id!);
        await fetchMessages(id!);
        setLoading(false);
    };

    const fetchReferral = async (referralId: string) => {
        // We join with doctors -> profiles to get name if possible
        // Use any cast to bypass strict typing of the generated client which doesn't know about new tables yet
        const { data, error: err } = await supabase
            .from('referrals')
            .select('*, doctors:doctor_id(*, profiles:id(full_name))')
            .eq('id', referralId)
            .single() as any;

        // Handle missing column/relation error for Demo Mode
        if (err) {
            if (err.code === 'PGRST200' || err.message?.includes('doctor_id') || err.message?.includes('relation') || err.code === 'PGRST204') {
                console.warn("Demo mode: Fetching basic referral only");
                const { data: basicRef } = await supabase
                    .from('referrals')
                    .select('*')
                    .eq('id', referralId)
                    .single();

                if (basicRef) {
                    setReferral({
                        ...basicRef,
                        doctor: {
                            full_name: "Dr. dr. Reza Y Purwoko (Demo Mode)",
                            photo_url: undefined
                        }
                    });
                    return;
                }
            }
            console.error("Error fetching referral", err);
            return;
        }

        if (!data) return;

        // Map the nested doctor profile name if available
        const doctorName = data.doctors?.profiles?.full_name || data.facility || "Doctor";
        const doctorPhoto = data.doctors?.photo_url;

        setReferral({
            ...data,
            doctor: {
                full_name: doctorName,
                photo_url: doctorPhoto
            }
        });
    };

    const fetchMessages = async (referralId: string) => {
        try {
            const { data, error } = await supabase
                .from('chat_messages' as any)
                .select('*')
                .eq('referral_id', referralId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (data) {
                setMessages(data as unknown as Message[]);
            }
        } catch (e: any) {
            // Mock messages if table missing
            if (e.code === '42P01' || e.message?.includes('does not exist') || e.code === 'PGRST205') {
                setMessages([
                    { id: '1', sender_id: 'system', message: 'Selamat datang di Tele-konsultasi bersama Dr. dr. Reza Y Purwoko.', created_at: new Date().toISOString(), is_read: true },
                    { id: '2', sender_id: 'doctor', message: 'Halo, saya dr. Reza. Ada yang bisa saya bantu dengan kondisi kulit Anda?', created_at: new Date().toISOString(), is_read: true }
                ] as any);
            }
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !currentUser || !id) return;

        const msg = newMessage.trim();
        setNewMessage("");

        const { error } = await supabase
            .from('chat_messages' as any)
            .insert({
                referral_id: id,
                sender_id: currentUser.id,
                message: msg
            });

        if (error) {
            // If error is due to missing table, keep the optimistic message (Demo Mode)
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST205') {
                toast.success("Pesan terkirim (Demo)");
            } else {
                toast.error(t("Gagal mengirim pesan", "Failed to send message"));
                console.error(error);
                // Remove optimistic message on real error
                setNewMessage(msg); // revert
            }
        }
    };

    if (loading) return <div className="p-8 text-center">{t("Memuat chat...", "Loading chat...")}</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4">
            <Card className="flex-1 flex flex-col overflow-hidden shadow-lg border-2">
                <CardHeader className="border-b bg-card flex-row items-center gap-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={referral?.doctor?.photo_url} />
                            <AvatarFallback>{referral?.doctor?.full_name?.substring(0, 2) || "Dr"}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-lg">{referral?.doctor?.full_name}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {referral?.status === 'pending' ? t("Menunggu konfirmasi", "Waiting for confirmation") : t("Sesi Aktif", "Active Session")}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
                    {messages.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm my-10">
                            {t("Belum ada pesan. Mulai konsultasi halo!", "No messages yet. Say hello!")}
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isMe = msg.sender_id === currentUser?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe
                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                    : "bg-white dark:bg-gray-800 border rounded-bl-none"
                                    }`}>
                                    <div>{msg.message}</div>
                                    <div className={`text-[10px] mt-1 opacity-70 ${isMe ? "text-right" : "text-left"}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </CardContent>

                <CardFooter className="border-t bg-card p-3">
                    <form
                        className="flex w-full gap-2"
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    >
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={t("Ketik pesan...", "Type a message...")}
                            className="flex-1 rounded-full"
                        />
                        <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0" disabled={!newMessage.trim()}>
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function Chat() {
    return (
        <LanguageProvider>
            <ChatContent />
        </LanguageProvider>
    );
}
