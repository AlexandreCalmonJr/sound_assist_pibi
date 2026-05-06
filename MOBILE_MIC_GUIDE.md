# Guia de Acesso ao Microfone (Mobile)

O SoundMaster Mobile possui ferramentas de análise acústica em tempo real (RTA, RT60, Timbre) que exigem acesso direto ao **microfone do dispositivo celular**. 

Por uma questão de segurança rigorosa imposta pelo Google e Apple, navegadores modernos (Chrome, Safari, Firefox) **bloqueiam automaticamente e silenciosamente** o uso de câmeras e microfones em sites que não sejam seguros (HTTPS).

Se você tentar acessar o painel mobile através do IP local da sua rede Wi-Fi (ex: `http://192.168.0.x:3000`), o microfone não funcionará e exibirá a mensagem de bloqueio.

Existem duas formas de resolver este bloqueio para a operação em campo:

---

## Método 1: Acesso Oficial pelo Túnel (Recomendado para iOS e Android)

O backend do SoundMaster está programado para gerar automaticamente um link de túnel seguro (Localtunnel) quando é iniciado. Este link criptografa a sua conexão local em um endereço HTTPS público temporário.

1. Inicie a aplicação SoundMaster Desktop na máquina conectada à Soundcraft.
2. Aguarde alguns segundos. O painel principal exibirá a mensagem: **"Gerando túnel HTTPS..."**.
3. Quando a mensagem mudar para verde e um link no formato `https://soundmaster-xyz.loca.lt` aparecer, um novo QR Code será gerado.
4. **Leia o QR Code** com a câmera do seu celular.
5. O navegador será aberto no link HTTPS (com cadeado verde).
6. Ao clicar em **"Ativar Microfone"**, o aviso padrão de permissão do celular aparecerá normalmente.

*Observação: Se o link não carregar de primeira, a página do túnel pode exibir um aviso pedindo para confirmar ("Click to continue"). Apenas clique para prosseguir e o painel abrirá.*

---

## Método 2: O "Hack" de Desenvolvedor (Para Android / Chrome)

Se a internet do local for instável para usar o túnel externo, você pode acessar via rede local Wi-Fi offline usando um truque oficial de desenvolvedor no Google Chrome do Android.

Isso ensina o seu celular a confiar no IP do computador local, ignorando a ausência do "HTTPS".

### Passo a Passo (Apenas Android):
1. Descubra o IP local exibido no aplicativo SoundMaster Desktop (ex: `http://10.5.5.46:3001`).
2. Abra o **Google Chrome** no seu celular.
3. Na barra de endereços do Chrome, digite:
   `chrome://flags`
4. Na barra de pesquisa ("Search flags") da página que abrir, digite:
   `insecure`
5. Localize a opção: **"Insecure origins treated as secure"**.
6. No campo de texto abaixo da opção, **digite o IP e a porta** do painel:
   `http://10.5.5.46:3001` *(Substitua pelo IP exibido na sua tela)*
7. Mude a caixa de seleção de **Disabled** para **Enabled**.
8. Clique no botão azul **Relaunch** no canto inferior direito para reiniciar o Chrome.
9. Agora você pode acessar o endereço via IP local e o microfone funcionará perfeitamente.

---

## E o iOS (iPhone / iPad)?

Dispositivos da Apple não possuem a página secreta `chrome://flags` para ignorar restrições, pois a Apple força todos os navegadores no iOS a usarem o motor estrito do Safari (WebKit).

**Solução para iPhones:** Você DEVE obrigatoriamente usar o **Método 1 (Túnel HTTPS)** ou conectar o SoundMaster Desktop em um domínio SSL real. Não há "atalhos" de IP local no iOS.
