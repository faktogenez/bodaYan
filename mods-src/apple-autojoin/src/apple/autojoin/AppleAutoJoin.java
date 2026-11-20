package apple.autojoin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screen.ConnectingScreen;
import net.minecraft.client.gui.screen.DirtMessageScreen;
import net.minecraft.client.gui.screen.IngameMenuScreen;
import net.minecraft.client.gui.screen.MainMenuScreen;
import net.minecraft.client.gui.screen.MultiplayerScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.WorkingScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import net.minecraftforge.client.event.GuiOpenEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/**
 * Полностью скрывает экран списка серверов ({@link MultiplayerScreen}).
 *
 * Перехватываем {@link GuiOpenEvent}: Forge постит его в {@code Minecraft.setScreen}
 * ДО фактической смены экрана и захватывает предыдущий экран в поле
 * {@code Minecraft.field_71462_r}. Через {@link GuiOpenEvent#setGui} подменяем
 * открываемый экран, поэтому список серверов никогда не отображается:
 *
 * <ul>
 *   <li>вход в раздел «Сетевая игра» из главного меню — сразу подключаемся к
 *       единственному серверу из servers.dat (его формирует лаунчер);</li>
 *   <li>«Завершить сетевую игру» (дисконнект) — ванильная кнопка сначала
 *       показывает {@link WorkingScreen}, а затем открывает список серверов;
 *       в этом случае возвращаемся в главное меню.</li>
 * </ul>
 */
@Mod("appleautojoin")
public class AppleAutoJoin {

    public AppleAutoJoin() {
        MinecraftForge.EVENT_BUS.register(this);
    }

    @SubscribeEvent
    public void onGuiOpen(GuiOpenEvent event) {
        if (!(event.getGui() instanceof MultiplayerScreen)) {
            return;
        }

        Minecraft mc = Minecraft.func_71410_x();
        // В момент GuiOpenEvent field_71462_r ещё содержит предыдущий экран
        // (Forge присваивает новый экран уже после события).
        Screen previous = mc.field_71462_r;

        // Возврат из игры: ванилла сначала показывает WorkingScreen
        // (Minecraft.func_213254_o), и только затем открывает список серверов.
        // Никогда не показываем список — уводим в главное меню.
        if (previous instanceof WorkingScreen
                || previous instanceof DirtMessageScreen
                || previous instanceof IngameMenuScreen) {
            event.setGui(new MainMenuScreen());
            return;
        }

        // Открытие раздела «Сетевая игра»: сразу подключаемся, минуя список.
        ServerData server = firstServer(mc);
        if (server == null) {
            event.setGui(new MainMenuScreen());
            return;
        }
        System.out.println("[AppleAutoJoin] Подключение к серверу: " + server.field_78845_b);
        event.setGui(new ConnectingScreen(new MainMenuScreen(), mc, server));
    }

    /** Первый сервер из servers.dat (лаунчер оставляет там ровно один сервер). */
    private static ServerData firstServer(Minecraft mc) {
        try {
            ServerList list = new ServerList(mc);
            list.func_78853_a();
            if (list.func_78856_c() > 0) {
                return list.func_78850_a(0);
            }
        } catch (Throwable ignored) {
            // список недоступен — трактуем как отсутствие сервера
        }
        return null;
    }
}
